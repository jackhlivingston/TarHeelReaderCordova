/*
 * created by Kerry Ellwanger
 */

define(["state"], function(state) {
	//this is a mapping of urls to functions
	var URLmap = [
		{"re": /^\/find\/(\?.*)?$/, "action": findBooks},
		{"re": /^\/book-as-json\/(\?.*)?$/, "action" : getBook}
	];
	
	function get(request){
		//this function handles getting request in the same manner that ajax request can be called
		//if the app is online, this function will actually do an ajax request
		//if the app is offline, it will attempt to return data formatted the same as the ajax response
        var online = state.get("connectivity");
		if (online){
			request.url = state.host + request.url;
			$.ajax(request);
		}
		else{
			var i = 0;
			while (i < URLmap.length){
				//go through the URLmap to try to map the url to a function
				candidate = URLmap[i];
				var match = candidate.re.exec(request.url);
				if (null!=match){
					candidate.action(request);
					break;
				}
				i++;
			}
		}
	}
	
	function setImageLocation(image){
		//in this function we want to make the src of an image point to a local file (with a relative url) instead of the online file
		var online = state.get("connectivity");
		if (!online){
			image.url = state.fileURL + image.url.replace(state.host,"").replace(state.fileURL,"");
		}
	}
	
	function getBook(request){
		//in this function we get a book from the file system
		function fail(){
			//this function will be called if there is an error with file system calls
			console.log("there was an error find books");
		}
		var book;
		//get the file system then call gotFS
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);

		function gotFS(fileSystem) {
			//got the file system now get the file
	        fileSystem.root.getFile("tarheelreaderapp/json/"+request.data.slug+".json",{create: false, exclusive: false}, gotFile, fail);
	    }

		function gotFile(fileEntry){
			//got the file now open it and get the book
			fileEntry.file(function(file){
				var reader = new FileReader();
				reader.onloadend = function(evt){
					console.log("got the book");
					book = JSON.parse(evt.target.result);
					//got the book so pass it back to the requester
					request.success(book);
				};
				reader.readAsText(file);
			},fail);
		}
	}
	
	function findBooks(request){
		//this function creates a list of the books that are available for offline use
		//first get the parameters which allows us to search them offline
		var params = {};
		var splitURL = request.url.split("?");
		if (splitURL.length == 2){
			splitURL[1].split("&").forEach(function(e){
				var keyValue = e.split("=");
				params[keyValue[0]] = keyValue[1];
			});
		}
		//go through the same process of opening files as the above function
		function fail(){
			console.log("there was an error find books");
		}
		console.log("finding books from the connection handler");
		var books = [];
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);

		function gotFS(fileSystem) {
	        fileSystem.root.getDirectory("tarheelreaderapp/json", {create: true, exclusive: false}, gotDE, fail);
	    }
		function gotDE(dirEntry){
			var directoryReader = dirEntry.createReader();
			//get all the entries in a directory
			directoryReader.readEntries(gotEntries,fail);
		}
		function gotEntries(entries){
			gotEntriesHelper(entries, 0); //this function will recursively loop through each of the books that are in the directory
		}
		function gotEntriesHelper(entries, index){
			if (index<entries.length){
				if (entries[index].file){
					entries[index].file(function(file){
							readFile(file).then(function(){gotEntriesHelper(entries,index+1);});
						},fail);
				}else{
					gotEntriesHelper(entries,index+1);
				}
			}else{
				console.log("returning books: ", JSON.stringify(books));
				request.success({"books":books,"more":false},"success",null);
			}
		}
		function readFile(file){
			//this function reads a file and returns a deferred that is resolved when the reading is finished 
			var $def = $.Deferred();
			var reader = new FileReader();
			console.log("got the file: ", JSON.stringify(file));
	        reader.onloadend = function(evt) {
	        	var book = JSON.parse(evt.target.result);
	        	//we check if the book matched the search params provided
	        	if (searchBook(book,params)){
	        		//if it does, format some of the data to the way we want it and then add it to the list of books
		        	book.cover = book.pages[0];
		        	book.rating = {
		                "icon": "images/"+book.rating_value+"stars_t.png",
		                "img": "images/"+book.rating_value+"stars.png",
		                "text": book.rating_value+" stars"
		        	};
		        	book.pages = book.pages.length;
			    	books.push(book);
			   	}
				$def.resolve();
	        };
	        reader.readAsText(file);
	        return $def;
		}
	}
	
	function searchBook(book,searchParams){
		//this method checks to see if a book matches the searchParams
		console.log("searching book: ",book,"for params: ",searchParams);
		if (searchParams.audience && searchParams.audience!=book.audience){
			return false;
		}
		if (searchParams.category){
			var contains = false;
			for (var i = 0; i<book.categories.length;i++){
				if (searchParams.category == book.categories[i]){
					contains = true;
					break;
				}
			}
			if (!contains){
				return false;
			}
		}
		if (searchParams.language && searchParams.language!=book.language){
			return false;
		}
		if (searchParams.reviewed && searchParams.reviewed == "R" && !book.reviewed){
			return false;
		}
		if (searchParams.search){
			var terms = searchParams.search.split("+");
			book.tags.forEach(function(e){
				for (var i=0;i<terms.length;i++){
					if (e.search(new RegExp(terms[i],'i'))!=-1){
						terms[i] = '';
					}
				}
			});
			book.pages.forEach(function(e){
				for (var i=0;i<terms.length;i++){
					if (e.text.search(new RegExp(terms[i],'i'))!=-1){
						terms[i] = '';
					}
				}
			});
			for (var i=0;i<terms.length;i++){
				if (terms[i]){
					return false;
				}
			}
		}
		return true;
	}
	
	return {
		get: get,
		setImageLocation: setImageLocation,
	};
});