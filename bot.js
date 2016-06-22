console.log('Bot init');
// Get all required npm modules
var package_info = require("./package.json");
for(var dependency in package_info.dependencies) {
    var name = dependency.replace('.js','').replace('-','');
    console.log("Loading "+dependency);
    try {
        eval("var "+name+" = require(\""+dependency+"\")");
        console.log("LIB : "+dependency+" [OK]");
    } catch(e) {
        console.log(e.stack);
        console.log(process.version);
        console.log("Please run npm install "+dependency+" and ensure it passes with no errors!");
        process.exit();
    }
}

// Check the existance of a given file
function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

// Get config data
try {
    var config = require("./config.json");
    console.log("FILE : config.json [OK]");
} catch (e) {
    console.log("Please check your config.json file.\n"+e.stack);
    process.exit();
}

// Get authentication data
try {
    var AuthDetails = require("./auth.json");
    console.log("FILE : auth.json [OK]");
} catch (e) {
    console.log("Please create an auth.json with at least an email and password.\n"+e.stack);
    process.exit();
}

console.log('Bot starts');

//  Define & Connect Bot on Discord
try {
    var options = { autoReconnect: true };
    var mybot = new discord.Client(options);
    console.log("OBJ : discord.Client() [OK]");
} catch (e) {
    console.log("Error discord.Client");
    process.exit();
}

// Preload plugins
try {
    var plugins = require("./plugins.js").init();
    console.log("PLUGINS : loaded [OK]");
} catch(e) {
    console.log("Error plugins\n"+e.stack);
    process.exit();
}

mybot.on('ready', function () {
    console.log("Bot is ready.");
    bot_hello();
});

mybot.on("disconnected", function () {
    console.log("Disconnected!");
    process.exit(1); //exit node.js with an error
});

// Get command lists
try {
    var basics = require("./commands/basics.json");
    console.log("FILE : basics.json [OK]");
} catch (e){
    console.log("Please check the basics.json file.\n"+e.stack);
    process.exit();
}
try {
    var advanced = require("./commands/advanced.json");
    console.log("FILE : advanced.json [OK]");
} catch (e){
    console.log("Please check the advanced.json file.\n"+e.stack);
    process.exit();
}
try {
    var humor = require("./commands/humor.json");
    console.log("FILE : humor.json [OK]");
} catch (e){
    console.log("Please check the humor.json file.\n"+e.stack);
    process.exit();
}

mybot.on("message", function(message) {
    if(message.author == mybot.user && config.self === false) {
        // if connection is token, bot doesn't have to check the message he send
        return;
    }

    var input = message.content.trim();

    //COMMAND
    if(input[0] === '!') {
        // message is a command
        // console.log("raw command: "+input);

        var user_cmd = {};
        user_cmd.name = input.split(" ")[0].substring(1);
        user_cmd.content = input.substring(user_cmd.name.length+2);
        user_cmd.name = user_cmd.name.toLowerCase();

        console.log("command "+user_cmd.name+" from "+message.author);

        var command = basics[user_cmd.name];

        // IS BASIC ?
        if(!command) {
            //console.log("command "+user_cmd.name+" not defined in basics!");
            command = advanced[user_cmd.name];
        }
        // IS ADVANCED ?
        if(!command) {
            //console.log("command "+user_cmd.name+" not defined!");
            command = humor[user_cmd.name];
        }
        // IS HUMOR ?
        if(!command) {
            console.log("command "+user_cmd.name+" not defined!");
            return;
        }

        // COMMAND EXISTS
        if (user_cmd.name == "command" || user_cmd.name == "advanced") {
            // HELP
            var info = command.message;
            if (user_cmd.name == "advanced") {
                    var cmd_list = advanced;
            } else {
                    var cmd_list = basics;
            }
            for(var cmd in cmd_list) {
                if(cmd_list[cmd].listed != false) {
                    info += "\n!" + cmd;
                    if (user_cmd.name == "advanced") {
                        var usage = cmd_list[cmd].usage;
                        if(usage){
                            info += " " + usage;
                        }
                        var description = cmd_list[cmd].description;
                        if(description){
                            info += "\n\t" + description;
                        }
                    }
                }
            }
            mybot.sendMessage(message.channel, info);
        } else {
            var alias = false;
            // IS ALIAS
            if (command.alias) {
                alias = true;
                var original = user_cmd.name;
                user_cmd.name = command.alias.split(" ")[0];
                user_cmd.content = command.alias.substring(user_cmd.name.length+1);
                console.log("!"+original+" alias transformed into !"+user_cmd.name+" "+user_cmd.content);
            }
            // IS FILE
            if (command.file) {
                mybot.sendFile(message.channel, "assets/"+command.file);
            } else if (plugins[user_cmd.name]) { // IS PLUGIN

                // retrieve the plugin command and its param
                var plugin_cmd = user_cmd.content.split(" ")[0];
                var plugin_param = user_cmd.content.substring(plugin_cmd.length+1).split(" ")[0].toLowerCase();
                plugin_cmd = plugin_cmd.toLowerCase();

                // set options to pass to plugin
                var options = {
                    bot: mybot,
                    message: message
                };

                if (plugin_cmd === "" || plugin_param === "") {
                    plugins[user_cmd.name].help(options);
                } else {
                    console.log("Command "+plugin_cmd+"('"+plugin_param+"') in plugin "+user_cmd.name);
                    if(command.listed == false) {
                        options["clear"] = true;
                    }
                    options["command"]  = plugin_cmd;
                    options["param"]    = plugin_param;
                    plugins[user_cmd.name].get(options);
                }

            } else if (command.message) { // IS BASIC MESSAGE
                if(command.listed == false) {
                    mybot.deleteMessage(message);
                }
                mybot.sendMessage(message.channel, command.message.replace(/#NL#/g,"\n"));
            } else { // EMPTY COMMAND (exists but without any action)
                console.log("Empty command "+user_cmd.name+": "+JSON.stringify(command));
            }
        }
    } else if(message.isMentioned(mybot.user)
        || input.toLowerCase().indexOf(mybot.user.username.toLowerCase()) >= 0
        || input.toLowerCase().indexOf(" bot ") >= 0) {

        // BOT MENTIONED
        //console.log("user "+message.author+" mentioned Bot");
        mybot.sendMessage(message.channel, "On parle de moi ? :smile:");

    }
});

// login Discord
if(config.connection == "token") {
    console.log("Bot try to connect via token");
    mybot.loginWithToken(AuthDetails.discord.token).then(bot_success).catch(bot_error);
} else if(config.connection == "account") {
    console.log("Bot try to connect via account");
    mybot.login(AuthDetails.discord.email, AuthDetails.discord.password).then(bot_success).catch(bot_error);
}

function bot_success(token){
    // handle success
    console.log('CONNECTED');
}

function bot_error(error){
    // handle error
    console.log('ERROR');
    console.log(error);
}

function bot_hello(){
    mybot.sendMessage(mybot.channels.get("id", /.*/), "Bonjour à tous, je suis en ligne et disponible pour vous aider :wink:");
}
