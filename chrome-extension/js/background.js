var domain = "https://api.inboxes.app";

chrome.alarms.create({ delayInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener(() => {
    chrome.storage.sync.get(['key'], function (result) {
        if (result.key) {
            getUnreadEmailCount(result.key)
        }
    });
});

async function getUnreadEmailCount(key) {
    const data = fetch(domain + '/get_unread_count', {
        method: 'GET',
        headers: new Headers({
            'Authorization': key,
        }),
    }).then(response => response.json())
    console.log(data, data.unread_emails)

    // $.ajax({
    //     type: 'POST',
    //     url: domain + '/get_unread_count',
    //     beforeSend: function (request) {
    //         request.setRequestHeader("Authorization", key);
    //     },
    //     dataType: 'json',
    //     success: function (data) {
    //         setBadge(data.unread_emails);
    //     }
    // });

}

function setBadge(count) {
    if (!Number.isInteger(count)) {
        chrome.browserAction.setBadgeText({ text: "" });
        return
    }

    if (count != 0) {
        chrome.browserAction.setBadgeText({ text: count + "" });
        chrome.browserAction.setBadgeBackgroundColor({ color: 'red' });
    } else {
        chrome.browserAction.setBadgeText({ text: "" });
    }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    chrome.storage.sync.get(['dec'], function (result) {
        setBadge(result.dec - request.counter)
    });
});
