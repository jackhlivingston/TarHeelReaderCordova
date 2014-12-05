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
        	//templates.render("login",{"logged_in":false});
        }
        
	    route.add('render', /^\/login\/(\?.*)?$/, loginRender);
});