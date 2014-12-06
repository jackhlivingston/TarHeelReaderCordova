This is a Cordova project that allows the tarheel reader to run as an app on ios and android.

To run the software, you need to install both cordova and the sdk for whatever platform you are installing it on.

To get cordova installed, first install nodejs from http://nodejs.org/
Next, from the command line, you can install cordova using "npm install -g cordova" (you may need to be root to do this)

For iOS, download and install xCode from https://developer.apple.com/xcode/
You will also need a developers liscence to actually deploy the app to a device

For android, the sdk can be downloaded from https://developer.android.com/sdk/index.html?hl=i 
Extract the contents of the file and move the sdk folder to an appropriate location. Then, add the sdk/tools and sdk/platform-tools to the system path
This will enable you to run the command "android" which will provide you with a tool to install the the version of the sdk you want (for cordova, you need "Android 4.4.2 (API 19)")
For androids, on the device you need to enable USB debugging. This can be done in settings -> developer options. "developer options" is hidden by default and to access it, go to settings -> about phone and tap build number 7 times.

Once you have everything set up, you can plug a device into your computer and run the software with one of the following commands while in the project directory:
cordova run android
cordova run ios

Now, an overview of how the app works.

The first thing that happens with the app is index.html (www/main) is loaded into view. This file then loads some javascript files such as jquery and requirejs.
www/js/main.js is also loaded which in turn loads most of the other js files in www/js/. Many of these files in turn call route.add to map urls to functions within the file
For example, in find.js, there is the line:
> route.add('render', /^\/find\/(\?.*)?$/, findRender);
This maps any urls that match the regular expresion /^\/find\/(\?.*)?$/ to call the function findRender which is defined in find.js
The way this is used is in controller.js which uses jquery to register a function with the onclick events that then call route.go(url).
This enables html to be constructed in the same way that it normally would be but when links are clicked, new pages are rendered with javascript instead of by a server.
For anything that requires connecting to a server, we use ajax request to get information.

Pages are rendered using mustache.js. This creates web pages dynamically using the templates in the folder www/templates.
