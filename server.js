var data_temp;

var util = require('util');

const server_version = "\x1b[95m\x1b[4mDatabase TestServer dvc.1.23021.0 | Development Version 1 | Februar 2023 | Update 1 | Bugfix 0\x1b[0m "; //Color codes: https://en.wikipedia.org/wiki/ANSI_escape_code#Colors

const fs = require("fs"); //readfile

const ws = new require('ws');
const wss = new ws.Server({noServer: true});
const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const clients = new Set();

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnect);
});

server.listen(port, hostname, () => {
  console.log(server_version);
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log("");
  console.log("");
});

function onSocketConnect(ws) {
  clients.add(ws);
  console_log("User connected", "Anmeldung", undefined, ws._socket.remoteAddress);

  ws.on('message', function(message) {
    if(bouncer(ws, message) == true){ //security check
        console_log(message, "onSocketConnect", undefined, ws._socket.remoteAddress);
        try{
          ws.send(main_script(message, ws));
        }
        catch(err){
          console_log("Schwerwiegender Fehler: Nachricht konnte nicht gesendet werden", "Websocket | OnSocketConnect | ws.on message | Sendeeinheit", "critical", ws._socket.remoteAddress);
          try{
            ws.send(new ReturnValue("error", err, "Ein schwerwiegender Feher ist aufgetreten, es konnte keine Korrekte Antwort verschickt werden.").asString());
          }
          catch{
            console_log("Schwerwiegender Fehler: Fehlerrückmeldung konnte nicht gesendet werden. Es liegt ein Problem mit der Socketfunktionalität vor.", "Websocket | OnSocketConnect | ws.on message | Sendeeinheit | ABSICHERUNGSFEHLERMELDER", "critical", ws._socket.remoteAddress);
          }
        }
    } 
  });

  ws.on('close', function() {
    console_log("Connection closed", "Abmeldung", undefined, ws._socket.remoteAddress);
    clients.delete(ws);
  });
}

//--------------------Main Code----------------------

function main_script(message, ws){
    try{
      message = JSON.parse(message);
      //return JSON.stringify(new ReturnValue("data", message));
      return inputHandler(message, ws);
    }
    catch(err){ //Inputformat ungültig
      console_log(err,"main_script", "warn", ws._socket.remoteAddress);
      return new ReturnValue("error", err, "Input Error").asString();
    }
}

var userSecurityLevel = 0;

function inputHandler(input, ws){ //Einstellungen laden und Sicherheitsfilter 1
  try{
    try{
      var settings = JSON.parse(fs.readFileSync("settings.json"));
    }
    catch(err){
      console_log("Settings konnten nicht abgerufen werden. Der Vorgang wurde aus Sicherheitsgründen abgebrochen.", "inputHandler", "critical");
      return new ReturnValue("error", err, "Eingabe konnte aufgrund von Sicherheitsproblemen nicht verarbeitet werden.").asString();
    }
    userSecurityLevel = accessHandler(input,ws, settings);
    console_log("Sicherheitslevel: "+ userSecurityLevel, "inputHandler", undefined, ws._socket.remoteAddress);
    //Eingabeparametersicherung
    if(userSecurityLevel >= 1){ //Sicherheitslevel 1: Standardzugriff
    }
    if(userSecurityLevel >= 2){ //Sicherheitslevel 2: vertrauenswürdiger Zugriff
      if(input.command){
        return commandHandler(input, ws);
      }else{
        console_log("Kein Command | Sicherheitslevel: "+ userSecurityLevel, "inputHandler", "warn", ws._socket.remoteAddress);
        return new ReturnValue("error", undefined, "Ungültige Aktion").asString();
      }
    }
    if(userSecurityLevel >= 3){ //Sicherheitslevel 3: Operator und Techniker Zugriff
    }
    if(userSecurityLevel >= 4){ //Sicherheitslevel 4: Administratorrechte, alles ist erlaubt.
    }
    //Optioal: Antwort bei zu niedrigem Sicherheitslevel für alle Aktionen
    if(userSecurityLevel < 2){
      return new ReturnValue("error", undefined, "Sicherheitslevel zu gering für Funktionsverarbeitungen.").asString();
    }
  }
  catch(err){
    console_log(err,"inputHandler", "warn", ws._socket.remoteAddress);
    return new ReturnValue("error", err, "InputHandler Error").asString();
  }
}

function accessHandler(input, ws, settings){ //Ermitteln des Sicherheitslevels
  try{
    if(input.accessKey){
      if(input.accessKey == settings.adminKey){
        return settings.adminSecurityLevel;
      }else if(input.accessKey == settings.operatorKey){
        return settings.operatorSecurityLevel;
      }else{
        return settings.standardSecurityLevel;
      }
    }else{
      return settings.standardSecurityLevel;
    }
  }
  catch{
    console_log("Fehler im accessHandler", "accessHandler", "critical", ws._socket.remoteAddress)
    return 0;
  }
}

function commandHandler(input, ws){ //Commands und Freigaben
  try{
    if(input.command == "openDatabase" && userSecurityLevel >= 2){ //openDatabase
      if(input.key && input.database_name){
        return accessDatabase(input, ws);
      }else{
        return new ReturnValue("error", null, "Nicht genug Argumente angegeben").asString();
      }
    }else if(input.command == "createDatabase" && userSecurityLevel >= 3){ //createDatabase
      if(input.database_name && input.key && input.id){
        return createDatabase(input.id, input.key, input.name, input, ws);
      }else{
        return new ReturnValue("error", null, "Nicht genug Argumente angegeben").asString();
      }
    }else if(input.command == "test"){ //test
      return new ReturnValue("data","Infotext").asString();
    }else if(input.command == "changeDatabase" && userSecurityLevel >= 2){ //changeDatabase
      return manipulateDatabase(input, ws);
    }else{
      console_log("Ungültiger Befehl: "+ input.command +" | Oder unzureichende Sicherheitsstufe: "+ userSecurityLevel,"commandHandler", "warn", ws._socket.remoteAddress);
      return new ReturnValue("error", undefined, "commandHandler Error: "+"Ungültiger Befehl: "+ input.command +" | Oder unzureichende Sicherheitsstufe: "+ userSecurityLevel,"commandHandler").asString();
    }
  }
  catch(err){
    console_log(err,"commandHandler", "warn", ws._socket.remoteAddress);
    return new ReturnValue("error", err, "commandHandler Error").asString();
  }
}

function accessDatabase(input, ws){ //Daten aus Database auslesen
  try{
    var database = JSON.parse(fs.readFileSync('databases.json')).databases;
    if(input.key == database[input.database_name].key){
      console_log("Zugriff auf "+ input.database_name +" mit dem key "+ input.key +" gewährt.", "accessDatabase", undefined, ws._socket.remoteAddress);
      var returning = database[input.database_name];
    }else{
      console_log("User hat erfolglos versucht die Database mit id: "+ input.database_name +" und key: "+ input.key +" zu öffnen","accessDatabase", "warn", ws._socket.remoteAddress);
      return new ReturnValue("error", null, "Key oder id Falsch").asString();
    }
    return new ReturnValue("database", returning).asString();
  }
  catch(err){
    console_log(err,"accessDatabase", "warn", ws._socket.remoteAddress);
    return new ReturnValue("error", err, "accessDatabase Error").asString();
  }
}

function manipulateDatabase(input, ws){ //Daten einer Database ändern
  /*console_log("User hat versucht manipulateDatabase auszuführen. Die Funktion ist noch nicht verfügbar.", "maniputlateDatabase", "warn", ws._socket.remoteAddress);
  return new ReturnValue("error", undefined, "manipulateDatabase ist noch nicht verfügbar.").asString();*/
  try{
    var source = JSON.parse(fs.readFileSync("databases.json"));
    if(input.key == source.databases[input.database_name].key){
      source.databases[input.database_name].data[input.dataKey] = input.data;
      fs.writeFileSync("databases.json", JSON.stringify(source, null, 2));
      return new ReturnValue("database", source.databases[input.database_name]).asString();
    }else{
      console_log("User hat erfolglos versucht die Database mit id: "+ input.database_name +" und key: "+ input.key +" zu Manipulieren","manipulateDatabase", "warn", ws._socket.remoteAddress);
      return new ReturnValue("error", null, "Key oder id Falsch").asString();
    }
  }
  catch(err){
    console_log(err,"manipulateDatabase", "warn", ws._socket.remoteAddress);
    return new ReturnValue("error", err, "manipulateDatabase Error").asString();
  }
}

function createDatabase(id, key, name, input, ws){ //neue Databse erstellen
  try{
    var databases = JSON.parse(fs.readFileSync("databases.json"));
    for(i=0;i<Object.keys(databases.databases).length;i++){
      if(Object.keys(databases.databases)[i] == id){
        console_log("Database mit der Id bereits vorhanden", "createDatabase", "warn", ws._socket.remoteAddress);
        return JSON.stringify(new ReturnValue("error", undefined, "Database mit der Id bereits vorhanden."));
      }
    }
    databases.databases[id] = new Database(key, name);
    fs.writeFileSync("databases.json", JSON.stringify(databases, null, 2));
    console_log("Database erstellt", "createDatabase", "warn");
    return new ReturnValue("feedback", "Database erstellt").asString();
  }
  catch(err){
    console_log(err,"createDatabase", "warn", ws._socket.remoteAddress);
    return new ReturnValue("error", err, "createDatabase Error").asString();
  }
}

class ReturnValue{
  constructor(type, value1, value2){
    this.type = type;
    if(type == "error"){
      if(value1 == null||value1 == undefined){
        value1 = {name:undefined,message:undefined}
      }
      this.data = {
        error:{
          name:value1.name,
          message:value1.message,
          context: value2
        }
      }
    }else if(type == "data"){
      this.data = value1;
    }else if(type == "database"){
      this.name = value1.name;
      this.key = value1.key;
      this.data = value1.data;
    }else if(type == "feedback"){
      this.message = value1;
    }
  }
  asString(){
    return JSON.stringify(this);
  }
}

class Database{
  constructor(key, name){
    this.name = name;
    this.key = key;
    this.data = {};
  }
}


Set.prototype.getByIndex = function(index) { return [...this][index]; } // Get specific elem from Set by index || number of elems: set.size
//-----------------OLD FUNCTIONS-------------------
function bouncer(ws, message){
    try{
        let blacklist_temp = fs.readFileSync('blacklist.json');
        let blacklist = JSON.parse(blacklist_temp);
        if(blacklist){
          for(i=0;i<blacklist.length;i++){
            if(blacklist[i].ip == ws._socket.remoteAddress){ // check if user is on blacklist
              console_log("Access Denied", "Bouncer", "warn", ws._socket.remoteAddress);
              return false;
            }else{return true;}
          }
        }else{console_log("no Blacklist");}
    }
    catch(err)
    {
        console.log(err);
        console_log("Failed", "Bouncer", "critical");
        console_log("Setze trotzdem fort", "Bouncer", "warn");
        return true;
    }
}

function console_log(log_message, origin, type, user){
    let date_ob = new Date();
    let hours = ("0" + (date_ob.getHours())).slice(-2);
    let minutes = ("0" + (date_ob.getMinutes())).slice(-2);
    let seconds = ("0" + (date_ob.getSeconds())).slice(-2);
  
    var timestamp = "["+ hours +":"+ minutes +":"+ seconds +"]";
  
    if(user == undefined){
      user = "";
    }else{
      user = "["+ user +"]";
    }
  
    if(origin != undefined){
      if(type != undefined){
        if(type == "critical"){
          timestamp = "\x1b[32m"+ timestamp +"\x1b[0m"+"\x1b[91m"+"["+ origin +"]"+"\x1b[0m"+"\x1b[90m"+ user +"\x1b[0m ";
        }else if(type == "warn"){
          timestamp = "\x1b[32m"+ timestamp +"\x1b[0m"+"\x1b[33m"+"["+ origin +"]"+"\x1b[0m"+"\x1b[90m"+ user +"\x1b[0m ";
        }
      }else{
        timestamp = "\x1b[32m"+ timestamp +"\x1b[0m"+"\x1b[90m"+"["+ origin +"]"+"\x1b[0m"+"\x1b[90m"+ user +"\x1b[0m ";;
      }
    }else{
      timestamp = "\x1b[32m"+ timestamp +"\x1b[0m"+"\x1b[90m"+ "[Main] " +"\x1b[0m"+"\x1b[90m"+ user +"\x1b[0m ";
    }
  
    console.log(timestamp + log_message);
    console.log("");
}
