var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var cognitiveservices = require("botbuilder-cognitiveservices");

// Restify Server Rubbish
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Bot Framework Service Connector Rubbish
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector).set('storage', inMemoryStorage);

var name, country, mode;

var start = 0;

bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                start = 0;
                var reply = new builder.Message()
                    .address(message.address)
                    .text('Hi, I\'m Labot. Before we start, type \'start\' to indicated that you agree our terms of service.');
                bot.send(reply);
            }
        });
    }
});

// LUIS Rubbish
var luisAppId = "0c7b118e-12e0-4d5b-b031-d939bc5d61a7";
var luisAPIKey = "5c6e0de88da047a5aa5e50c1ff555d90";
var luisAPIHostName = 'westus.api.cognitive.microsoft.com';
var LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Restart Dialog
/*
bot.dialog('RestartDialog',
    (session) => {
        session.send('Ok, let\'s restart.');
        session.replaceDialog('welcome');
    }
).triggerAction({
    matches: 'Restart'
});
*/

// QnA Rubbish

var KBID, AKey;

var qnaResult;

function catQuestions(arr) {
    var result = [];
    for (var item in arr) {
        console.log(arr[item]);
        if (arr[item].score > 0.6) {
            /*
            var temp_longest = "";
            for (var q in arr[item].questions) {
                if (arr[item].questions[q].length > temp_longest.length) {
                    temp_longest = arr[item].questions[q];
                }
            }
            result.push(temp_longest);
            */
            result.push(arr[item].questions[0]);
        }
    }
    return result;
}

bot.dialog('QnADialog', [
    (session) => {
        session.send('You reached the QnADialog intent. You said \'%s\'.', session.message.text);
        session.beginDialog('basicQnAMakerDialog');
        session.endDialog();
    }
]);

bot.dialog('showQuestionList', [
    (session) => {
        session.beginDialog("QnADialog");
        if (qnaResult) {
            builder.Prompts.choice(session, "Ask la", catQuestions(qnaResult.answers), { listStyle: 3 });
        }
    },
    (session, results) => {
        session.endDialogWithResult(results);
    }
]);

/*
bot.dialog('QnADialog', [
    (session) => {
        session.send('You reached the QnADialog intent. You said \'%s\'.', session.message.text);
        if (session.message.text == "Work in foreign country") {
            session.beginDialog('workInCountry');
        } else {
            session.beginDialog('basicQnAMakerDialog');
        }
    },
    (session) => {
        if (mode == "List") {
            console.log("qnaResult", qnaResult);
            if (qnaResult) {
                // session.send(question_id.toString());
                console.log(qnaResult);
                builder.Prompts.choice(session, "Ask la", catQuestions(qnaResult.answers), { listStyle: 3 });
            }
            mode = "Type";
        }
        session.endDialog();
    }
]);
*/

// QnAMakerTool Rubbish

var qnaMakerTools = new cognitiveservices.QnAMakerTools();
bot.library(qnaMakerTools.createLibrary());

// Main Rubbish

bot.dialog('main', [
    (session) => {
        session.beginDialog("welcome");
    },
    (session, results) => {
        session.beginDialog("askCountry");
    },
    (session, results) => {
        session.userData.country = results.response.entity;
        session.send("Got it! " + session.userData.name + ", you are looking for " + session.userData.country +"'s information.");
        session.beginDialog("askTypeorList");
    },
    (session, results) => {
        session.userData.mode = results.response.entity;
        session.send("Got it! " + session.userData.name + ", you are directed to " + session.userData.mode +" mode.");
        if (session.userData.mode == "List") {
            session.beginDialog("askWhichInList");
        }
    },
    (session, results) => {
        if (session.userData.mode == "List") {
            session.beginDialog("showQuestionList");
        }
    },
    (session, results) => {
        session.beginDialog("QnADialog");
    },
    (session, results) => {
        session.endDialog();
    }
]);

// Welcome Rubbish

bot.dialog('welcome', [
    (session) => {
        session.userData.name = null; // init
        session.beginDialog("askUsername");
    },
    (session, results) => {
        session.userData.name = results.response;
        session.send("Welcome, " + name + "!");
        session.send("I'm here to provide information about labour law and employment rights in belt and road countries as a foreign employee");
        // session.send("If you ever get stuck, don't worry, you can type 'restart' to start over.");
        session.endDialog();
    }
]);

bot.dialog('askUsername', [
    (session) => {
        builder.Prompts.text(session, "What's your name?");
    },
    (session, results) => {
        session.endDialogWithResult(results);
    }
]);

// everytime choose country will INIT QnADialog and select database

bot.dialog('askCountry', [
    (session) => {
        builder.Prompts.choice(session, "Which country's information are you looking for?", ["Thailand", "Kazakhstan"], { listStyle: 3 });
    },
    (session, results) => {
        switch (results.response.entity) {
            case "Thailand":
                KBID = "af2a6a49-425a-4a78-bf72-139df6b14c00";
                AKey = "f07fe224-2915-4839-b843-4a502e4f1739";
                break;
            case "Kazakhstan":
                KBID = "31a4511f-cdd7-4299-aef1-5276158c163d";
                AKey = "f07fe224-2915-4839-b843-4a502e4f1739";
                break;
            default:
                KBID = "af2a6a49-425a-4a78-bf72-139df6b14c00";
                AKey = "f07fe224-2915-4839-b843-4a502e4f1739";
                break;
        }

        // Init QnADialog Rubbish

        var QnArecognizer = new cognitiveservices.QnAMakerRecognizer({
            knowledgeBaseId: KBID,
            authKey: AKey,
            endpointHostName: "https://technolawqna.azurewebsites.net/qnamaker",
            top: 5
        });

        var basicQnAMakerDialog = new cognitiveservices.QnAMakerDialog({
            recognizers: [QnArecognizer],
            defaultMessage: 'No match! Try changing the query terms!',
            qnaThreshold: 0.3,
            feedbackLib: qnaMakerTools
        });

        basicQnAMakerDialog.respondFromQnAMakerResult = function (session, qnaMakerResult) {
            qnaResult = qnaMakerResult;
            // when mode==list, just retrieve but not show
            if (session.userData.mode == "Type") {
                var output = qnaMakerResult.answers[0].answer;
                session.send(output);
                // return orgiFunc.apply(this, arguments);
            }
        };
        // End of QnA Dialog Init Rubbish

        session.endDialogWithResult(results);
    }
]);

bot.dialog('askTypeorList', [
    (session) => {
        builder.Prompts.choice(session, "Would you like to randomly type a question or view the FAQ list?", ["Type", "List"], { listStyle: 3 });
    },
    (session, results) => {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('askWhichInList', [
    (session) => {
        var catagories = [
            "Work in foreign country",
            "Insurance",
            "Sexual Harassment",
            "Anti-discrimination",
            "Personal injuries",
            "Rights & Benefits"
        ];
        builder.Prompts.choice(session, "Please select a catagory", catagories, { listStyle: 3 });
    },
    (session, results) => {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('/', function(session, args) {
    console.log("default intent");
    if (start == 0) {
        start = 1;
        session.beginDialog("welcome");
    } else {
        session.beginDialog("QnADialog");
    }
});

bot.dialog('workInCountry', [
    function(session) {
        builder.Prompts.choice(session, "Work in foreign country", ["Work Visa", "Work Permit"], { listStyle: 3 });
    },
    function(session, result) {
        session.beginDialog("QnADialog");
        session.endDialog();
    }
]);

bot.dialog("continue", [
    function(session) {
        builder.Prompts.choice(session, "Do you need more help?", ["Yes", "No"], { listStyle: 3 });
    },
    function(session, results) {
        if (results.response.entity == "Yes") {
            builder.Prompts.choice(session, "Would you like to type a question or view the FAQ list?", ["Type", "List"], { listStyle: 3 });
        } else {
            session.begin("end");
            session.endDialog();
        }
    },
    function(session, results) {
        mode = results.response.entity;
        session.userData.mode = results.response.entity;
        session.send("Got it! " + name + ", you are directed to " + mode +"mode.");
        if (session.userData.mode == "List") {
            session.replaceDialog("list");
        }
        session.endDialog();
    }
]);

bot.dialog("end", function(session) {
    session.send("Thank you for using!");
    session.endDialog();
});
