define([
    "route",
    "state",
    "controller",
    "find",
    "read",
    "write",
    "busy",
    "navigation",
    "help",
    "yourbooks",
    "login"],
    function(route, state, controller) {
        $(function() {
            var url = window.location.href,
                $page = $('.active-page');
            //console.log('url = ', url);
            //console.log('root = ', History.getRootUrl());
            //console.log('page = ', History.getPageUrl());
            $page.trigger('PageRendered');
            route.go('init', url, $page);
            $page.trigger('PageVisible');
        });
    });
