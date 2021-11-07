var domain = "https://api.inboxes.app";
chrome.alarms.create({ periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(() => {
    chrome.storage.sync.get(['key'], function (result) {
        if (result.key) {
            getUnreadEmailCount(result.key)
        }
    });
});

async function getUnreadEmailCount(key) {
    const data = await fetch(domain + '/get_unread_count', {
        method: 'POST',
        headers: new Headers({
            'Authorization': key,
        }),
    }).then(response => response.json())

    setBadge(data.unread_emails)

}

function setBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count + "" });
        chrome.action.setBadgeBackgroundColor({ color: 'red' });
        return
    }

    chrome.action.setBadgeText({ text: "" });

}

