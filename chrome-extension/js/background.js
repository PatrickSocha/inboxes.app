var domain = "https://api.inboxes.app";

chrome.storage.sync.get(['key'], function (result) {
    if (result.key) {
        getUnreadEmailCount(result.key)
        setInterval(function () {
            getUnreadEmailCount(result.key)
        }, 30 * 1000);
    }
});

function getUnreadEmailCount(key) {
    $.ajax({
        type: 'GET',
        url: domain + '/get_unread_count',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        dataType: 'json',
        success: function (data) {
            setBadge(data.unread_emails);
        }
    });

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

// function setNumber(i) {
//     chrome.storage.sync.set({ count: i });
// }

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    chrome.storage.sync.get(['dec'], function (result) {
        setBadge(result.dec - request.counter)
    });
});
