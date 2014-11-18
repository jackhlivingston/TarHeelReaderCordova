define([ ], function () {

    var rootUrl = null;
    var routeMaps = {};

    function addRoute(map, re, action) {
        if (!(map in routeMaps)) {
            routeMaps[map] = [];
        }
        routeMaps[map].push({ re: re, action: action });
    }

    function doRoute(map, url, context) {
        if (!(map in routeMaps)) return false;
        console.log("finding route:  ",url," in map: ",map);
        var candidates = routeMaps[map];
        for(var i = 0; i < candidates.length; i++) {
            console.log(i," checking for a match with re: ",candidates[i].re);
            var match = candidates[i].re.exec(url);
            if (match) {
                console.log("found a match");
                var r = candidates[i].action.apply(context, match);
                // allow the action to reject the call by returning false
                if (r !== false) {
                    return r;
                }
            }
        }
        return false;
    }

    return {
        add: addRoute,
        go: doRoute
    };
});
