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
      ws.send(main_script(message, ws));
    } 
  });

  ws.on('close', function() {
    console_log("Connection closed", "Abmeldung", undefined, ws._socket.remoteAddress);
    clients.delete(ws);
  });
}


function main_script(message, ws){
    try{
      message = JSON.parse(message);
      //return JSON.stringify(new ReturnValue("data", message));
      return inputHandler(message, ws);
    }
    catch(err){ //Inputformat ungültig
      console_log(err,"main_script", "warn", ws._socket.remoteAddress);
      return JSON.stringify(new ReturnValue("error", err, "Input Error"));
    }
}

function inputHandler(input, ws){
  try{
    if(input.command){
      if(input.command == "openDatabase"){
        if(input.key && input.database_name){
          return accessDatabase(input, ws);
        }else{
          return JSON.stringify(new ReturnValue("error", null, "Nicht genug Argumente angegeben"))
        }
      }else{
        console_log("Ungültiger Befehl: "+ input.command,"inputHandler", "warn", ws._socket.remoteAddress);
        return JSON.stringify(new ReturnValue("error", undefined, "InputHandler Error: "+"Ungültiger Befehl: "+ input.command,"inputHandler"));
      }
    }else{
      return JSON.stringify(input);
    }
  }
  catch(err){
    console_log(err,"inputHandler", "warn", ws._socket.remoteAddress);
    return JSON.stringify(new ReturnValue("error", err, "InputHandler Error"));
  }
}

function accessDatabase(input, ws){
  try{
    var database = JSON.parse(fs.readFileSync('databases.json')).databases;
    if(input.key == database[input.database_name].key){
      console_log("Zugriff auf "+ input.database_name +" mit dem key "+ input.key +" gewährt.", "accessDatabase", undefined, ws._socket.remoteAddress);
      var returning = database[input.database_name];
    }else{
      console_log("User hat erfolglos versucht die Database mit id: "+ input.database_name +" und key: "+ input.key +" zu öffnen","accessDatabase", "warn", ws._socket.remoteAddress);
      return JSON.stringify(new ReturnValue("error", null, "Key oder id Falsch"));
    }
    return JSON.stringify(new ReturnValue("database", returning));
  }
  catch(err){
    console_log(err,"accessDatabase", "warn", ws._socket.remoteAddress);
    return JSON.stringify(new ReturnValue("error", err, "accessDatabase Error"));
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
    }
  }
}

class Database{
  constructor(id, key, name){
    this.name = name;
    this.key = key;
    this.id = id;
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
