function checkVisible(elem) {
  var docViewTop = $(window).scrollTop();
  var docViewBottom = docViewTop + $(window).height();

  var elemTop = $(elem).offset().top;
  var elemBottom = elemTop + $(elem).height();

  return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom)
    && (elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

function runOnVisible(elem, fn) {
  seen = false
  window.setInterval(function () {
    if (checkVisible($(elem)) && !seen) {
      fn()
      seen = true
    }
  }, 50);
}