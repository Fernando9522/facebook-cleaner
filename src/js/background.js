// This file is part of Target ___.

// Target ___ is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// any later version.

// Target ___ is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Target ___.  If not, see <http://www.gnu.org/licenses/>.

var greeting = "HELLO TARGET ___ <3",
    devMode = true,
    db,
    session = false,
    helper = require("./background_helpers.js"),
    dbstores = require("./dbstores.js");

function generalListeners() {
    chrome.runtime.onUpdateAvailable.addListener(function(details) {
        chrome.browserAction.setBadgeText({ text: "!" });
        chrome.runtime.reload();
    });
    chrome.runtime.onInstalled.addListener(function(details) {
        console.log("onInstalled", details.reason);
    });
    chrome.runtime.onMessage.addListener(function(req, sender, sendRes) {
        switch (req.type) {
            case "contentLoaded":
                console.log("[>>] " + sender.tab.url + "\t" + sender.tab.status);
                if (parseInt(req.data[0]) == 1) {
                    setTimestamp("start", req.type);
                };
                // FIX proper escaping of url
                db.pages.add({ url: sender.tab.url, timestamp: helper.now(), inSession: req.data[0] });
                break;
            case "profilePic":
                chrome.storage.local.set({
                    "dsUser": {
                        profilePic: {
                            dataUri: req.data[0],
                            rawImg: req.data[1]
                        }
                    }
                });
                break;
            case "backup":
                helper.backup(db);
                break;
            case "import":
                if (req.data.dataselfie != undefined) {
                    helper.import(db, req.data.dataselfie, sender.tab.id);
                } else {
                    helper.importError(sender.tab.id);
                }
                break;
            case "delete":
                helper.resetDB(db, initDB, sender.tab.id);
                chrome.storage.local.clear(initOptions);
                break;
            case "saveLooked":
                db.looked.add(req.data);
                break;
        }
        return true;
    });
    var lastWebReq = 0;
    chrome.webRequest.onCompleted.addListener(function(info) {
        var dif = info.timeStamp - lastWebReq;
        // limit the number of notifications sent to content
        if (dif > 1500 || lastWebReq == 0) {
            helper.sendToContent(info.tabId);
            console.log("%c[>>] new webRequest", helper.clog.fb);
        }
        lastWebReq = info.timeStamp;
    }, {
        urls: ["https://www.facebook.com/*", "http://www.facebook.com/*"],
        types: ["image"]
    });
}

function saveTimestamp(now, status, event) {
    db.transaction("rw", db.timespent, function() {
        db.timespent.toCollection().last(function(last) {
            if (status == "start" && last == undefined) {
                db.timespent.add({ start: now });
            } else if (status == "start" && last.stop != undefined) {
                db.timespent.add({ start: now });
            } else if (status == "stop" && last.stop == undefined) {
                db.timespent.update(last.id, { stop: now });
            };
        });
    });
}

function setTimestamp(status, event) {
    if (session == true && status == "stop") {
        session = false;
        console.log("%c----- [sessions][>>]\t" + status + "\t" + event, helper.clog.fb);
    } else if (session == false && status == "start") {
        session = true;
        console.log("%c+++++ [sessions][>>]\t" + status + "\t" + event, helper.clog.fb);
    }
    helper.setBrowserActionIcon(status);
    saveTimestamp(moment().format(), status, event);
};

function initDB(notify) {
    // if db already exists, dexie only opens
    db = new Dexie("TargetBlankLocalDB");
    db.version(1).stores(dbstores);
    db.open().catch(function(err) {
        console.log("%c[DB][<<] error", helper.clog.magenta);
        console.error(err.stack || err);
        alert("There has been an error. Database was not initiated.");
    }).finally(function() {
        console.log("%c[DB][<<] opened", helper.clog.magenta);
        // FIX might not need
        if (notify != false) {
            console.log("Database was initiated.");
        }
    });
}

function init() {
    console.log("%c" + greeting, helper.clog.lime);
    initDB(false);
    // generalListeners();
    // helper.setBrowserActionIcon(session);
    helper.getPermissions();
}

init();

chrome.browserAction.onClicked.addListener(function(){
    chrome.tabs.create({ url: chrome.runtime.getURL("views/me.html") });
})


