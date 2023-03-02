websocket = {
    callback:{
        current: null,
        history:[],
        manage(current){
            if(current != this.current){
                this.history.push(this.current);
                this.current = current;
            }
        },
        reset(){
            this.current = null;
        }
    },
    start(){ //Verbindung Herstellen
        socket = new WebSocket("ws://127.0.0.1:3000");

        socket.onopen = (e)=>{
            console.log("Websocket ready");
        }

        socket.onmessage = (message)=>{
            console.log("Message received");
            this.handleMessage(message);
        }

        socket.onerror = (error)=>{
            console.error(`Websocket error ${error}`);
        }
    },
    send(message, callback){ //Eine Nachricht Senden. || Es kann eine Callbackfunktion angegeben werden
        if(callback!=null){
            this.callback.manage(callback);
        }
        if(typeof message != "string"){
            message = prepareMessage(message);
        }

        try{
            socket.send(message);
            return true;
        }
        catch(err){
            error.show("Message konnte nicht gesendet werden.");
            console.error(err);
            return false;
        }
    },
    handleMessage(message){ //Leitet die Antwort weiter an die Callbackfunktion
        try{
            var callback = this.callback.current;
            this.callback.reset("current");
            window[callback](message);
        }
        catch{
            console.warn("NO Callback");
        }
    },
    prepareMessage(message){//Kann verwendet werden, um eine Nachricht vor dem Senden vorzubereiten.
        try{
            return JSON.stringify(message);
        }
        catch{
            error.show("[prepareMessage] failed");
            return "INVALID VALUE";
        }
    },
    async serverPing(){
        if(websocket.send("PING")==false){
            error.show("SERVER OFFLINE");
        }else{
            error.show("SERVER ONLINE");
        }
        setTimeout(()=>{websocket.serverPing()}, 1000);
    }
}




error = {
    loadContainer(){
        this.container = document.getElementById("error_container");
        return this.container;
    },
    show(content){
        this.loadContainer();
        this.container.innerHTML = content;
        this.container.style.opacity = 1;
            setTimeout(()=>{this.container.style.opacity = 0}, 5000);
        return true;
    },
}