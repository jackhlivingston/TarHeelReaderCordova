/**
 * @author Kerry Ellwanger
 */


define([ "route",
         "templates",
         "state",
         "keyboard",
         "speech",
         "page",
         "ios",
         "connectionhandler",
         "jquery.scrollIntoView",
        ], function(route, templates, state, keys, speech, page, ios, connection) {
        
        function loginRender(){
        	console.log("login rendering");
        	//return templates.render("login",{"logged_in":false});
        	return false;
        }
        
	    route.add('render', /^\/login\/(\?.*)?$/, loginRender);
});