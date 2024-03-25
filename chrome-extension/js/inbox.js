var domain = "https://api.inboxes.app";
var version = '0.0.13';
const fadeTimer = 200; // animation time in milliseconds.

let quickCopy; // used to hold the state and change text in the quick copy text box.
let mp; // mixpanel
let key;
let userState = {
    subscribed: false,
    addressLimitExceeded: false,
}

chrome.storage.sync.get(["key"], function (result) {
    if (result.key) {
        key = result.key
        return run();
    }

    createAccount()
});

function createAccount() {
    $.ajax({
        type: 'POST',
        url: domain + '/create_account',
        dataType: 'json',
        success: function (data) {
            setKey({ "key": data.key }).then(() => {
                key = data.key
                run();
            });
        }
    });
}

async function run() {
    await getSubscriptionStatus().then(() => {
        mixpanel.init('7005ab5e9dd1029929e5f9473d48bb53', {
            api_host: 'https://api.inboxes.app/mixpanel',
        });
        mixpanel.identify(userState.user_id);
        mp = mixpanel
    })


    getEmailAddress();
    let surveyInProgress = await showSurvey()
    if (!surveyInProgress) {
        getNews();
        await getInbox();
    }

    incrementAppUsageCounter()
}

async function loadScreen(screen, fn) {
    function isContentLoaded() {
        return $("#load").children().length > 0;
    }
    const observerConfig = { childList: true };
    let contentLoadedPromise = new Promise(resolve => {
        let observer = new MutationObserver((mutationsList, observer) => {
            if (isContentLoaded()) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(document.getElementById('load'), observerConfig);
    });

    $("#load").load(screen, function() {
        $("#load [data-i18n]").each(function() {
            let i18n = $(this).attr('data-i18n');
            $(this).html(chrome.i18n.getMessage(i18n));
        });
    });

    await contentLoadedPromise;
    if (fn !== undefined) {
        fn();
    }
    $("#load").fadeIn(fadeTimer);
}


// EMAIL
async function getEmailAddress() {
    if (quickCopy === "email") {
        return
    }

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_new_address',
        dataType: 'json',
        success: function (data) {
            $('#disposableEmailForm').val(data.email)
        },
        error: function (data, a) {
            userState.addressLimitExceeded = true;
            $('.news').hide();
            $('#disposableEmailForm').val("Get more addresses...");
            $('#myTooltip').text("Click to find out how");
            $('#disposableEmailForm').css('cursor', 'pointer');
            $('#disposableEmailForm').on("click", function (e) {
                loadScreen("views/viewUpgradeEmailLimitExceeded.html")
                mp.track('email limit exceeded: upgrade');
            })
        }
    });

    quickCopy = "email"
}

async function getInbox() {
    setNavigationState(
        ['viewUnreadButton', 'viewReadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewUnreadButton',
        ['viewInboxContainer']
    );

    // document ready required for getInbox() which is the first screen ever loaded.
    $(document).ready(function() {
        loadScreen("views/viewEmailInbox.html")
    });

    getEmailAddress();
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                loadScreen("views/viewInboxZero.html", function() {
                    checkIsPinned();
                });
                return
            }
            populateMessageList(data);
        }
    });
    mp.track('email: get inbox');
}

async function checkIsPinned(){
    let userSettings = await chrome.action.getUserSettings();
    if (!userSettings.isOnToolbar) {
        $("#pin-extension").fadeIn(fadeTimer);
        mp.track('app: is not pinned');
    } else {
        $("#extension-pinned-explain-app").fadeIn(fadeTimer);
        mp.track('app: is pinned');
    }
}

async function getReadInbox() {
    setNavigationState(
        ['viewUnreadButton', 'viewReadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewReadButton',
        ['viewInboxContainer']
    );
    loadScreen("views/viewEmailInbox.html")

    getEmailAddress();
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_read_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                loadScreen("views/viewEmptyUnread.html")
                return
            }
            populateMessageList(data);
        }
    });
    mp.track('email: get read inbox');
}

function populateMessageList(data) {
    $.each(data, function (index, element) {
        const cl = ".em-" + index;
        $('.em').clone()
            .addClass("em-" + index)
            .removeClass("em")
            .appendTo(".list")
            .fadeIn(fadeTimer)

        const deleteElem = cl + ' .delete-button';
        $(cl).on("click", function (e) {
            if ($(e.target).is(deleteElem)) {
                // console.log(e.target)
                return false;
            }
            openEmail(element.ID)
        });
        $(cl + ' #subject').text(element.Subject)

        $(deleteElem).on("click", function () {
            deleteInbox(element.To, cl)
        });

    });
}

function openEmail(id) {
    $("html, body").animate({ scrollTop: 0 }, 250);
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_email',
        data: JSON.stringify({ id }),
        dataType: 'json',
        success: function (data) {
            var emailBody = "<base target=\"_blank\" />" + data.ParsedBody
            emailBody = emailBody.replaceAll('<script', '<script async').replaceAll('<img', '<img loading="lazy"')

            $('#subject').text(data.Subject);
            $('#to').text(data.To);
            $("#iframe-loading").show();

            $('#viewMessageContainer').show()
            $('#iframe').attr("srcdoc", emailBody);
            $("#iframe").on('load', function () {
                $("#iframe-loading").hide();
                var body = this.contentWindow.document.body,
                    html = this.contentWindow.document.documentElement;

                var height = Math.max(body.scrollHeight, body.offsetHeight,
                    html.clientHeight, html.scrollHeight, html.offsetHeight);

                this.style.height = height + 'px';
            });

            // $('#viewMessageContainer').css("height", height + "px")
            $('.message').fadeIn(fadeTimer);
            $('#list').fadeOut(fadeTimer);

        }
    });
    mp.track('email: open email');
}

// Domain
async function addDomain() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['viewInboxContainer']
    );

    if (userState.subscribed === false) {
        mp.track('add domain: upgrade');
        loadScreen("views/viewUpgrade.html")
        return
    }

    mp.track('addd domain');
    loadScreen("views/viewAddDomain.html")
}

async function addDomainProcess() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['viewInboxContainer']
    );

    if (userState.subscribed === false) {
        loadScreen("views/viewUpgrade.html")
        return
    }

    loadScreen("views/verifying.html")

    const customDomain = $("#addDomainForm").val();
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/create_domain',
        dataType: 'json',
        data: JSON.stringify({
            "domain": customDomain,
        }),
        success: function (data) {
            toggleConfetti();
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Domain added 👌")
            $("#verifyingText").text("You'll need to use the already created email before the new one is used.")
            mp.track('Add domain: success');
            setTimeout(function () {
                toggleConfetti();
            }, 1500)
        },
        error: function (data, a) {
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Error adding custom domain")
            $("#verifyingText").text(data.responseJSON.error)
        }
    });
}

// SMS
async function getSMSInbox() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSMSButton',
        ['viewInboxContainer']
    );

    if (userState.subscribed === false) {
        loadScreen("views/viewUpgrade.html")
        mp.track('Sms: upgrade');
        return
    }

    getSubscriptionStatus();
    if (userState.subscribed === true && !userState.phone_number) {
        loadScreen("views/viewAttachNumber.html")
        mp.track('Sms: create number');
        return
    }

    showPhoneNumber();

    loadScreen("views/viewSMSInbox.html")
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_sms_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                loadScreen("views/viewSMSInboxZero.html")
                return
            }
            populateSMSInbox(data);
        }
    });
    mp.track('Sms: get view inbox');
}

function populateSMSInbox(data) {
    $.each(data, function (index, element) {
        const cl = ".sms-msg-" + index;
        $('.sms-msg').clone()
            .addClass("sms-msg-" + index)
            .removeClass("sms-msg")
            .appendTo(".sms-list")
            .fadeIn(fadeTimer)

        $(cl).on("click", function (e) {
            openSMSThread(element.id)
        });

        $(cl + ' #from').text(element.from)
        $(cl + ' #message').text(element.message)

    });
}

async function openSMSThread(id) {
    loadScreen("views/viewSMSThread.html")
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_sms_thread',
        data: JSON.stringify({
            "message_id": id,
        }),
        dataType: 'json',
        success: function (data) {
            populateSMSThread(data);
        }
    });
    mp.track('Sms: view thread');
}

function populateSMSThread(data) {
    $('#from').text("From: " + data.from).fadeIn(fadeTimer)

    $.each(data.messages, function (index, element) {
        const cl = ".sms-msg-" + index;
        $('.sms-msg').clone()
            .addClass("sms-msg-" + index)
            .removeClass("sms-msg")
            .appendTo(".sms-list")
            .fadeIn(fadeTimer)

        $(cl + ' #message').text(element.message)
    });
    $('#sms-disclamer').text("Sending SMS not supported.").fadeIn(fadeTimer)
}

function showPhoneNumber() {
    if (quickCopy === "phone") {
        return
    }
    quickCopy = "phone"

    $('#disposableEmailForm').val(userState.phone_number).fadeIn(fadeTimer);
}

async function addNumberProcess() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['viewInboxContainer']
    );

    if (userState.subscribed === false) {
        loadScreen("views/viewUpgrade.html")
        return
    }

    loadScreen("views/verifying.html")

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/create_phone_number',
        dataType: 'json',
        success: function (data) {
            toggleConfetti();
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Phone number created 👌")
            $("#verifyingText").text("Your new number is ", data.phone_number)
            setTimeout(function () {
                toggleConfetti();
            }, 1500)
            mp.track('Sms: Add number success');
        },
        error: function (data, a) {
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Error creating number")
            $("#verifyingText").text(data.responseJSON.error)
            mp.track('Sms: Add number fail');
        }
    });
}

// SETTINGS
function updateEmail() {
    loadScreen("views/verifying.html")
    const email = $("#emailForm").val();

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        data: JSON.stringify({
            "email": email,
        }),
        url: domain + '/update_account_email',
        dataType: 'json',
        success: function (data) {
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Check your email")
            $("#verifyingText").text("Enter your unique verification code in the settings page.")
            mp.track('Actions: email registered');
        },
        error: function (data, a) {
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Error updating email")
            $("#verifyingText").text(data.responseJSON.error)
        }
    });
}

function verifyAccountEmail() {
    loadScreen("views/verifying.html")

    const codeParts = [];
    for (let i = 0; i < 5; i++) {
        codeParts.push($("#validation-" + i).val());
    }
    const code = codeParts.join('').toUpperCase();


    setTimeout(function () {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            data: JSON.stringify({ "code": code }),
            url: domain + '/verify_account_email',
            dataType: 'json',
            success: function (data) {
                toggleConfetti();
                $("#verifyingSpinner").remove()
                $("#verifyingHeader").text("Email updated 👌")
                mp.track('Actions: email verified');
                setTimeout(function () {
                    toggleConfetti();
                }, 1500)
            },
            error: function (data) {
                $("#verifyingSpinner").remove()
                $("#verifyingHeader").text("Invalid code")
                $("#verifyingText").text("Check you entered the correct code and try again.")
            }
        });

    }, 1000);


}

function getSettings() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    getEmailAddress();
    loadScreen("views/viewSettings.html", function() {
        if (userState.subscribed) {
            $(".settingsUpGradeButton").hide();
        }
    })

    mp.track('Settings: view settings');
}

function getAccountSettings() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    loadScreen("views/viewAccountSettings.html")
    // TODO: return manage subscription link
    mp.track('Settings: view user account settings');
}

function getViewEditEmail() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    loadScreen("views/viewAttachEmail.html")
    mp.track('Settings: attach email page');
}

function getViewValidateAction() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']
    );

    $('body').on('keyup', '.actions-form', function (e) {
        const keyPress = e.keyCode;
        const backspace = 8;
        const aZ09 = keyPress >= 48 && keyPress <= 90;

        if (keyPress === backspace) {
            $(this).prev().focus();
        } else if (aZ09) {
            $(this).next().focus();
        }

        let count = 0
        for (let i = 0; i < 5; i++) {
            if ($('#validation-' + i).val() !== "") {
                count++;
            }
        }

        if (count === 5) {
            setTimeout(verifyAccountEmail, 200);
        }
    });

    $('body').on('paste', '.actions-form', function (e) {
        let pasteData = e.originalEvent.clipboardData.getData('text').split("");
        if (pasteData.length !== 5) {
            pasteData = void 0; // unset data, we shouldn't store it.
            return
        }

        for (let i = 0; i < 5; i++) {
            $('#validation-' + i).val(pasteData[i]);
            $("#validation-" + i).focus();
        }
    });

    loadScreen("views/viewValidateAction.html")
    mp.track('Actions: validate action');
}

function deleteInbox(email, elem) {
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/delete_inbox',
        data: JSON.stringify({ email }),
        dataType: 'json',
        success: function (data) {
            $(elem).fadeOut(fadeTimer)
            mp.track('email: deleted email');
        }
    });
}

function closeEmail() {
    $('.message').fadeOut(fadeTimer, function () {
        $('.message > .subject').text("")
        $('.message > .to').text("")
        $('.emailBody').remove()
    })
    $('#viewMessageContainer').fadeOut(fadeTimer)
    $('#list').delay(100).fadeIn(fadeTimer)
    $('#iframe').css("height", "0px")
}



function copyEmailAddress() {
    if (!userState.addressLimitExceeded) {
        const copyText = document.getElementById("disposableEmailForm");
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        document.execCommand("copy");

        $(".tooltiptext").text("Copied!");
    }
}

function incrementAppUsageCounter() {
    chrome.storage.sync.get("appUsageCounter", function (obj) {
        const i = obj.appUsageCounter
        if (i >= 0) {
            setKey({ "appUsageCounter": i + 1 })
        } else {
            setKey({ "appUsageCounter": 0 })
        }
    });
}

function getNews() {
    chrome.storage.sync.get("appUsageCounter", function (obj) {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            data: JSON.stringify({
                "app_opens": obj.appUsageCounter,
                "app_version": version
            }),
            url: domain + '/get_news',
            dataType: 'json',
            success: function (data) {
                if (data)
                    showNews(data);
            }
        });
    });
}

async function getSubscriptionStatus() {
    return new Promise((resolve) => {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            url: domain + '/get_subscription',
            dataType: 'json',
            success: function (data) {
                userState = data
                return resolve(data)
            }
        });
    })
}

function upgradeAccount() {
    $('#upgradeAccountButton').html('<i class="fa-solid fa-circle-notch fa-spin"></i>')
    mp.track('Upgrade: button pressed');
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        data: JSON.stringify({
            "product": "yearly"
        }),
        url: domain + '/paddle_create_payment_link',
        dataType: 'json',
        success: function (data) {
            chrome.tabs.create({url: data.link});
            // return false;
        }
    });
}

function showNews(data) {
    $('#news').show()
    $('#news-content').html(data.news);

    if (data.background_color)
        $('#news').css('backgroundColor', data.background_color);

    if (data.image)
        $('#news').css('background-image', 'url(' + data.image + ')');
}

// Questionnaire
async function showSurvey() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            url: domain + '/get_questionnaire',
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
                // There are no surveys to show, surveysInProgress is false
                if (jqXHR.status === 204) {
                    resolve(false);
                    return
                }

                loadScreen("views/survey.html", function() {
                    userState.questionnaire = {
                        questionnaire_id: data.id,
                        question_id: data.questions[0].id
                    }

                    $('#questionnaireQuestion').text(data.questions[0].question);
                    data.questions[0].options.forEach(function (option) {
                        var button = $("<button>").addClass("button").attr("id", "questionnaireResponse").text(option);
                        $("#questionnaireOptions").append(button);
                    });

                    // There is a survey in progress
                    resolve(true);
                })
            },
            error: function(xhr, status, error) {
                console.error("Error fetching questionnaire:", error);
                reject(error);
            }
        });
    });
}

function questionnaireResponseSelected() {
    $(".button").removeClass("button-secondary"); // Remove the selected class from all buttons
    $(this).addClass("button-secondary"); // Add the selected class to the clicked button
    var selectedOption = $(this).text();

    userState.questionnaire.answer = selectedOption;

    if (selectedOption.toLowerCase() === "Other".toLowerCase()) {
        $("#questionnaireResponseCustomContainer").fadeIn(fadeTimer);
    } else {
        $("#questionnaireResponseCustomContainer").fadeOut(fadeTimer, function() {
            $("#questionnaireResponseCustom").val("");
        });
    }
}

function questionnaireSubmit() {
    var customResponse = $("#questionnaireResponseCustom")
    if (customResponse.val() !== "") {
        userState.questionnaire.answer = customResponse.val();
    }

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/update_questionnaire_response',
        dataType: 'json',
        data: JSON.stringify({
            id: userState.questionnaire.questionnaire_id,
            answers: [
                {
                    question_id: userState.questionnaire.question_id,
                    answer: userState.questionnaire.answer
                }
            ],
        }),
        success: function (data) {
            getInbox();
        }
    });
}

// Listeners
$(document).ready(function () {
    // views
    $(document).delegate("#closeEmail", "click", closeEmail);
    $(document).delegate("#disposableEmailForm", "click", copyEmailAddress);
    $(document).delegate("#viewAddDomain", "click", addDomain);
    $(document).delegate("#viewReadButton", "click", getReadInbox);
    $(document).delegate("#viewUnreadButton", "click", getInbox);
    $(document).delegate("#viewSMSButton", "click", getSMSInbox);
    $(document).delegate("#viewSettingsButton", "click", getSettings);
    $(document).delegate("#viewAccountSettings", "click", getAccountSettings);
    $(document).delegate("#viewEditEmail", "click", getViewEditEmail);
    $(document).delegate("#viewValidateAction", "click", getViewValidateAction);
    $(document).delegate("#upgradeAccountButton", "click", upgradeAccount);

    // forms
    $(document).delegate("#updateAddDomain", "click", addDomain);
    $(document).delegate("#updateAddDomainSubmit", "click", addDomainProcess);
    $(document).delegate("#updateAddNumber", "click", getInbox);
    $(document).delegate("#updateAddNumberSubmit", "click", addNumberProcess);
    $(document).delegate("#updateEmail", "click", updateEmail);

    // questionnaire
    $(document).delegate("#questionnaireResponse", "click", questionnaireResponseSelected);
    $(document).delegate("#questionnaireSubmit", "click", questionnaireSubmit);
});

// //
// Helpers
//
function setKey(keyObj) {
    return chrome.storage.sync.set(keyObj);
}
function deleteKey(key) {
    chrome.storage.sync.remove(key, function () {
        console.log('key deleted');
    });
}

// // //
// Nav
//

// state control
const setupViewState = {
    viewUnreadButton: true,
    viewSettingsButton: false,
    viewSMSButton: false,
    viewReadButton: false,

    viewInboxContainer: true,
    load: false
}

function setNavigationState(nav, navHighlight, showState) {
    // reset all handlers
    $('body').off()

    // copy default view setup
    const currentState = jQuery.extend({}, setupViewState);

    // reset then set highlighted nav bar item
    for (const [k, v] of Object.entries(currentState)) {
        $('#' + k).removeClass('selected');
    }
    if (typeof navHighlight === 'string') {
        $('#' + navHighlight).addClass('selected');
    }

    // toggle nav and view states
    for (const i in nav) {
        currentState[nav[i]] = true;
    }
    for (const i in showState) {
        currentState[showState[i]] = true;
    }

    // paint states
    for (const [k, v] of Object.entries(currentState)) {
        if (v === true)
            $('#' + k).show()
        if (v === false)
            $('#' + k).hide()
    }

    // reset states
    $('.list').empty();
    closeEmail();
}
