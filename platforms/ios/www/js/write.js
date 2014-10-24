define(['route',
        'templates',
        'controller',
        'fileuploader',
        'jquery.ui.touch-punch',
        'jquery.inlineedit'
        ],
    function(route, templates, controller, fileuploader) {
        var maxCaptionLength = 130;  // no page text may be longer than this

        var galleryData = {}; // parameters for the photo search
        var $editDialog = null; // holds the page editor dialog which we'll create only once
        var editIndex = 0; // index of the current page in the editor
        var $galleryDialog = null; // holds the gallery preview dialog
        var galleryIndex = 0; // holds the index into the gallery preview
        var isModified = false; // true when the book has been edited
        var editId = null; // set to the id of the book we are editing
        var notAgain = false; // true after publish to prevent multiple hits

        function setupGallery() {
            var $page = $('.write-page.active-page');

            $('.gallery').on('click', 'img', function(e) {
                var $imgs = $('.gallery img'),
                    index = $imgs.index(this);
                showGalleryPreview(index);
            });
            var $form = $page.find('.image-search');
            $form.submit(function(e) {
                e.preventDefault();
                //console.log('submit');
                clearErrors();
                $('.gallery-back,.gallery-more').button('disable');
                $('.gallery').empty();
                var query = $page.find('input[name=query]').val();
                var emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4})\b/i;
		var useridRe = /\b(by:[-a-zA-Z0-9_.]+)\b/i;
                var match = query.match(emailRe) || query.match(useridRe);
                if (match) { // email or username query
                    query = query.replace(match[0], '');
                    $.when(getNsidFromEmailOrUserid(match[0])).then(function(nsid) {
                        fetchGallery({ user_id: nsid, query: query });
                    });
                } else {
		    fetchGallery({ query: query });
		}
                return false;
            });

            $('.button', '.writing-controls').button().button('disable');
            $('.gallery-back').click(function() {
                fetchAnotherGallery(-1);
                return false;
            });
            $('.gallery-more').click(function() {
                fetchAnotherGallery(+1);
                return false;
            });

            $(window).resize(updateThumbnailSize); // update the thumbnails' size on window resize
        }

        function fetchAnotherGallery(step) {
            clearErrors();
            galleryData.page += step;
            $.ajax({
                url: '/photoSearch/',
                data: galleryData,
                dataType: 'jsonp',
                jsonp: 'jsoncallback',
                success: function (result) {
                    //console.log('success!', result);
                    var p = result.photos,
                        g = $('.gallery');

                    g.empty();
                    if (!p || !p.photo || p.photo.length === 0) {
                        showError('em-g-not-found');
                        return;
                    }
                    $.each(p.photo, function (index, photo) {
                        var url = '/photo' + photo.farm + '/' + photo.server + '/' + photo.id + '_' + photo.secret,
                            w = parseInt(photo.width_m, 10),
                            h = parseInt(photo.height_m, 10);
                        $('<img>').prop('src', url + '_s.jpg')
                            .prop('title', photo.title)
                            .attr('data-width', w)
                            .attr('data-height', h)
                            .appendTo(g);
                    });
                    updateThumbnailSize();
                    $('.gallery-back').button(p.page > 1 ? 'enable' : 'disable');
                    $('.gallery-more').button(p.page < p.pages ? 'enable' : 'disable');
                }
            });
        }

        function updateThumbnailSize() {
            var $g = $(".gallery"),
                $images = $g.find("img"),
                gwidth = $g.width(),
                picsPerRow,
                marginRight,
                size; // width and height

            if(!$images.length) { // no images to adjust, return
                return;
            } else {
                picsPerRow = gwidth > 720 ? 9 : 6;
                marginRight = gwidth > 720 ? 4 : 2;
                borderWidth = 1;
                size = Math.floor((gwidth - (marginRight + borderWidth*2) * picsPerRow) /
                    picsPerRow);

                $images.css({
                    width: size + 'px',
                    height: size + 'px',
                    marginRight: marginRight + 'px',
                    border: borderWidth + 'px solid black'
                });
            }
        }

        function fetchGallery(options) {
            //console.log('fetchGallery', options);
            // TODO: set loading here
            galleryData = {
                page: 1,
                per_page: 18, // 18 per page would allow an even number of pictures per row
                extras: 'url_m' // ask for the medium url so I can get the size
            };
            if ('query' in options) {
                var q = options.query;
                if (q.match(/^:/)) {
                    galleryData.license = '4';
                    q = q.slice(1);
                }
                galleryData.text = q;
		if (q) {
                    galleryData.sort = 'relevance';
		} else {
                    galleryData.sort = 'interestingness-desc';
		}
            }
            if ('user_id' in options) {
                galleryData.user_id = options.user_id;
            }

            fetchAnotherGallery(0);
        }

        function showGalleryPreview(startIndex) {
            galleryIndex = startIndex;

            function showPreviewImage() { // display the currently selected image in the preview dialog
                // get all the images
                var $imgs = $('.gallery img');
                // restrict the galleryIndex to the range
                if (galleryIndex >= $imgs.length) {
                    galleryIndex = 0;
                } else if (galleryIndex < 0) {
                    galleryIndex = $imgs.length - 1;
                }
                // get the current image
                var $img = $($imgs.get(galleryIndex));
                // extract image parameters
                var url = $img.attr('src'),
                    width = $img.attr('data-width'),
                    height = $img.attr('data-height'),
                    prop = width > height ? 'width' : 'height';
                //console.log('url is', url);
                // create the preview image with the same
                var $dimg = $('<img />')
                    .attr('src', url.replace('_s', ''))
                    .css(prop, '100%')
                    .attr('data-width', width)
                    .attr('data-height', height);
                // insert into the preview dialog
                $galleryDialog.find('>img').replaceWith($dimg);
                // display the image clipped title on the preview dialog
                var title = $img.attr('title');
                if (title && title.length > 32) {
                    title = title.substr(0,30) + '...';
                }
                $galleryDialog.dialog('option', 'title', title);
            }

            if (!$galleryDialog) {
                // create the dialog if it doesn't already exist
                $galleryDialog = $('<div class="galleryPreviewDialog"><img /></div>').dialog({
                    width: 'auto',
                    resizable: false,
                    modal: true,
                    draggable: false,
                    autoOpen: false,
                    open: function() {
                        $(this).parents('.ui-dialog-buttonpane button:eq(2)').focus();
                    },
                    buttons: [
                        {
                            text: $('.wlPrevious').html(),
                            click: function() { }
                        },
                        {
                            text: $('.wlAddToBook').html(),
                            click: function() {
                                var $img = $(this).find('>img');
                                //console.log('img', $img);
                                var page = {
                                    url: $img.attr('src').replace('_s', ''),
                                    width: $img.attr('data-width'),
                                    height: $img.attr('data-height'),
                                    text: ''
                                };
                                //console.log('page', page);
                                addPage(page);
                                // confirm the page creation in the dialog title
                                $(this).dialog('option', 'title', $('.wlPageAdded').html());
                                var step2 = $('.step2').offset();
                                $img.clone().appendTo('body')
                                    .css({
                                        position: 'absolute',
                                        margin: 0,
                                        zIndex: 1003,
                                        width: $img.width()/16 + 'em',
                                        height: $img.height()/16 + 'em'
                                    }).css($img.offset())
                                    .animate({
                                        top: step2.top,
                                        left: step2.left + 100,
                                        width: '40px',
                                        height: '40px',
                                        opacity: 0
                                    },1000, function() {
                                        $(this).remove();
                                        $('.step2 h3').effect('highlight', {}, 1000);
                                    });
                            }
                        },
                        {
                            text: $('.wlNext').html(), // pulling the labels from the page
                            click: function() { }
                        }
                    ]
                });
            }
            // insert the first image
            showPreviewImage();
            $galleryDialog.dialog('open');
        }

        // add a page to the book
        function addPage(page, isInit) {
            var view = {
                image: page,
                caption: page.text || ''
            };
            templates.setImageSizes(view.image);
            var $p = $('<li class="thr-book-page">' + templates.render('bookPage', view) + '</li>');
            $p.find('a').remove();
            $p.find('.thr-colors').removeClass('thr-colors');
            $p.find('.thr-colors-invert').removeClass('thr-colors-invert');
            $p.find('.thr-caption').toggleClass('text-too-long',
                view.caption.length >= maxCaptionLength);
            $('.write-pages').append($p);
            $('.noPicturesMessage').hide();
            if (!isInit) {
                setModified();
            }
            // require permission to upload images
            if (page.url.substring(0, 8) == '/uploads') {
                $('label.uploadPermission').addClass('needPermission');
            }
        }
        // initialize book pages from an existing book
        function initializeBookState(book) {
            //console.log('initBook', book);
            $('input[name=title]').val(book.title);
            $('input[name=author]').val(book.author);
            $('select[name=language]').val(book.language);
            $('input[name=category]').prop('checked', false);
            $.each(book.categories, function (index, category) {
                $('input[value=' + category + ']').prop('checked', true);
            });
            $('select[name=audience]').val(book.audience);
            $('select[name=type]').val(book.type);
            $('input[name=tags]').val(book.tags.join(' '));
            $('input[name=reviewed]').prop('checked', book.reviewed);
            $.each(book.pages.slice(1), function (index, page) {
                addPage(page, true);
            });
        }
        // extract the books state from the controls
        function extractBookState() {
            //console.log('start extract');

            var book = {},
                $write = $('.active-page.write-page');
            book.title = $.trim($write.find('input[name=title]').val());
            book.author = $.trim($write.find('input[name=author]').val());
            book.categories = $write.find('.categories input[type=checkbox]:checked').map(function(i, v) {
                return $(v).prop('value'); }).get();
            book.type = $write.find('select[name=type]').val();
            book.audience = $write.find('select[name=audience]').val();
            book.language = $write.find('select[name=language]').val();
            var tags = $.trim($('input[name=tags]').val());
            tags = tags.replace(/[-.,\/#!@#$%\^&*()_=+\[\]{};:'"<>?\\|`~]/g, " ");
            tags = tags.replace(/\s{2,}/g, " ");
            book.tags = tags.split(' ');
            book.reviewed = $write.find('input[name=reviewed]:checked').length > 0;
            book.pages = $write.find('.write-pages li').map(function(i, p) {
                var $p = $(p),
                    caption = $.trim($p.find('.thr-caption').html()) || '',
                    img = $p.find('img.thr-pic'),
                    width = parseInt(img.attr('data-width'), 10),
                    height = parseInt(img.attr('data-height'), 10);
                return {
                    text: caption,
                    url: img.attr('src'),
                    width: width,
                    height: height
                };
            }).get();
            if (book.pages.length > 0) {
                var p = book.pages[0];
                var page = {
                    text: book.title,
                    url: p.url.replace('.jpg', '_t.jpg'),
                    width: p.width > p.height ? 100 : Math.round(100 * p.width / p.height),
                    height: p.width > p.height ? Math.round(100 * p.height / p.width) : 100
                };
                book.pages.unshift(page);
            }
            return book;
        }
        function saveAsDraft() {
            clearErrors();
            $('.save').attr('disabled', 'disabled'); // disable the button to prevent multiples
            var book = extractBookState();
            //console.log('book is', book);
            $.ajax({
                url: '/book-as-json/',
                type: 'post',
                data: {
                    book: JSON.stringify(book),
                    publish: false,
                    id: editId
                },
                dataType: 'json'
            }).then(function(nBook) {
                //console.log('post returns', nBook);
                logEvent('write', 'draft', nBook.ID);
                editId = nBook.ID;
                $('.save').removeAttr('disabled'); // renable button
                clearModified();
                showError('peSaved');
            });
        }
        function validate(condition, id) {
            if (!condition) {
                showError('peMessage');
                showError(id);
            }
        }
        function publish() {
            $('.publish').attr('disabled', 'disabled'); // disable the button to prevent multiples
            var book = extractBookState();
            // validate the book locally
            clearErrors();
            validate(book.title && book.title.length > 0, 'peTitle');
            validate(book.author && book.author.length > 0, 'peAuthor');
            validate(book.pages.length > 3, 'peLength');
            var cap = true, len = true;
            for(var i=1; i < book.pages.length; i++) {
                cap = cap && book.pages[i].text.length > 0;
                len = len && book.pages[i].text.length <= maxCaptionLength;
            }
            validate(cap, 'peCaption');
            validate(len, 'peCaptionLength');
            validate(book.language != ' ', 'peLanguage');
            validate(book.categories && book.categories.length <= 4, 'peCategories');
            // check for image upload permission if needed
            var needPermission = $('label.uploadPermission').hasClass('needPermission');
            var hasPermission = $('input[name="permission"]').prop('checked');
            validate(hasPermission || !needPermission, 'pePermission');

            if ($('.peMessage').hasClass('show-error')) {
                $('.publishErrors').get(0).scrollIntoView(false);
                $('.publish').removeAttr('disabled');
                var errors = [];
                $('.publishErrors').find('.show-error').each(function() {
                    var cls = $(this).attr('class');
                    var msg = /pe\w+/.exec(cls)[0];
                    errors.push(msg);
                });
                logEvent('write', 'validate', errors.join());
                return;
            }
            if (notAgain) {
                logEvent('write', 'notAgain', 'override');
                return;
            }
            notAgain = true;
            //console.log('publish', book);
            $.ajax({
                url: '/book-as-json/',
                type: 'post',
                data: {
                    book: JSON.stringify(book),
                    publish: true,
                    id: editId
                },
                dataType: 'json'
            }).then(function(nBook) {
                //console.log('post returns', nBook);
                clearModified();
                if (nBook.status == 'publish') {
                    controller.gotoUrl(nBook.link, nBook.title, { data_type: 'book' });
                    logEvent('write', 'publish', nBook.slug);
                } else { // publish failed for some reason
                    showError('peSaved');
                    logEvent('write', 'publish-failed', 'why?');
                    notAgain = false;
                    $('.publish').removeAttr('disabled'); // renable button
                }
            });
        }
        // create the page editor dialog
        function createPageEditDialog() {
            $editDialog = $('<div class="thr-book-page edit-page"></div>').dialog({
                width: 'auto',
                resizable: false,
                modal: true,
                draggable: false,
                autoOpen: false,
                open: function(event, ui) {
                    $(this).find('.thr-caption').inlineEdit({
                        buttons: '',
                        saveOnBlur: true,
                        control: 'textarea',
                        placeholder: $('.wlClickToEdit').html(),
                        save: saveEditCaption
                    });
                    

                }
            });
            $editDialog.on('click', 'a.thr-back-link', function() {
                editIndex -= 1;
                //console.log('prev', editIndex);
                setupEditContent();
                return false;
            });
            $editDialog.on('click', 'a.thr-next-link', function() {
                editIndex += 1;
                //console.log('next', editIndex);
                setupEditContent();
                return false;
            });
            $editDialog.on('click', 'img.deleteIcon', deletePage);
            $editDialog.on('click', 'img.copyIcon', copyPage);
            // limit max caption length
            $editDialog.on('keyup input paste', 'textarea', function(){
                var warnLength = maxCaptionLength - 10,
                    $this = $(this),
                    text = $this.val() || '',
                    length = text.length;

                $this.toggleClass('text-too-long-warn', length >= warnLength);
                $this.toggleClass('text-too-long', length >= maxCaptionLength);

            });
        }

        // initialize the page editor with its content
        function setupEditContent() {
            var $wp = $('.write-pages li'); // the list of book pages
            // make sure the index is in bound wrapping at the ends
            if (editIndex < 0) {
                editIndex = $wp.length - 1;
            } else if (editIndex >= $wp.length) {
                editIndex = 0;
            }
            var $page = $($wp.get(editIndex)); // the current page
            var $img = $page.find('img');
            var caption = $page.find('p.thr-caption').html() || '';
            var view = {
                image: {
                    url: $img.attr('src'),
                    width: $img.attr('data-width'),
                    height: $img.attr('data-height')
                },
                caption: caption ? caption : $('.wlClickToEdit').html()
            };
            templates.setImageSizes(view.image); // size the image
            var $content = $(templates.render('bookPage', view)); // render like any book page
            $content.filter('a.thr-home-icon,a.thr-settings-icon').hide(); // remove some unneeded links
            $editDialog.empty().append($('.wEditHelp').html()).append($content); // update dialog body
            var $deleteIcon = $('<img class="deleteIcon" src="images/delete.png" />');
            $deleteIcon.attr('title', $('.wDeleteThisPage').html());
            $editDialog.append($deleteIcon);
            var $copyIcon = $('<img class="copyIcon" src="images/copy.png" />');
            $copyIcon.attr('title', $('.wCopyThisPage').html());
            $editDialog.append($copyIcon);
            $editDialog.dialog('option', 'title', '');  // clear the title
            $editDialog.find('p.thr-caption').toggleClass('text-too-long',
                caption.length >= maxCaptionLength);
            
        }

        // save the edited caption
        function saveEditCaption(e, data) {
            var $wp = $('.write-pages li'), // the list of book pages
                $page = $($wp.get(editIndex)), // the current page
                $caption = $page.find('p.thr-caption'),
                tooLong = typeof(data.value) == 'string' &&
                          data.value.length > maxCaptionLength;
            //console.log('saving', data.value, 'was', $caption.html());
            $caption.html(data.value).toggleClass('text-too-long', tooLong);
            setModified();
            $editDialog.find('p.thr-caption').toggleClass('text-too-long', tooLong);
        }

        // delete a book page
        function deletePage() {
            var $wp = $('.write-pages li'); // the list of book pages
            var $page = $($wp.get(editIndex)); // the current page
            $page.remove(); // remove it
            setupEditContent();
            setModified();
        }

        // copy a book page
        function copyPage() {
            var $wp = $('.write-pages li'); // the list of book pages
            var $page = $($wp.get(editIndex)); // the current page
            var $copy = $page.clone();
            $page.after($copy);
            setModified();
            $editDialog.dialog('option', 'title', $('.wlPageCopied').html());
        }

        // edit a book page
        function editPage(e) {
            if (!$editDialog) {
                createPageEditDialog();
            }
            editIndex = $('.write-pages li').index(this);

            var $window = $(window),
                ww = $window.width(),
                wh = $window.height(),
                pw = ww/(48 + 4),
                ph = wh/(36 + 10),
                p = Math.min(pw, ph);
            setupEditContent();
            $editDialog.css('font-size', p + 'px');
            $editDialog.dialog('open');
            
        }

        // warn the user if they are leaving the page without saving
        function confirmLeaving(e) {
            if (isModified) {
                if (!confirm(warnModified())) {
                    e.preventDefault();
                    return false;
                } else {
                    clearModified(); // if the user insists on leaving the page, then set isModified to false
                }
            }
            return true;
        }

        // warning message for beforeunload
        function warnModified() {
            return $('.wLoseWork').html();
        }

        // set the indicator that the book has been modified
        function setModified() {
            //console.log('setModified', isModified);
            if (!isModified) {
                isModified = true;
                $(window).on('beforeunload', warnModified);
                $('.save').removeAttr('disabled');
            }
            
        }

        // clear the modified indication
        function clearModified() {
            if (isModified) {
                isModified = false;
                $(window).off('beforeunload');
                $('.save').attr('disabled', 'disabled');
            }
        }

        // show an error message
        function showError(className) {
            $('.' + className).addClass('show-error');
        }

        // hide error messages
        function clearErrors() {
            $('.error-messages p').removeClass('show-error');
        }

        // translate email address into flickr nsid
        var nsidCache = {}; // store translations to avoid multiple lookups
        function getNsidFromEmailOrUserid(email) {
            if (email in nsidCache) {
                return nsidCache[email]; // return from the cache
            } else {
                var def = $.Deferred(),
		    by = /^by:/.test(email),
		    url = by ? '/photoSearchUsername/' : '/photoSearchEmail/',
		    data = by ? { username: email.slice(3) } : { find_email: email };
                $.ajax({ // ask flickr
                    url: url,
                    data: data,
                    dataType: 'jsonp',
                    jsonp: 'jsoncallback',
                    success: function(data) {
                        if (data.stat === 'ok') {
                            nsidCache[email] = data.user.nsid;
                            def.resolve(data.user.nsid);
                        } else {
                            showError('em-g-invalid-email');
                            def.reject();
                        }
                    },
                    error: function() {
                        showError('em-g-network-error');
                        def.reject();
                    }
                });
                return def;
            }
        }

        // initialize the writing page.
        function writeInit(url, id, copyId) {
            //console.log('write', id, copyId);
            var $page = this;

            var bookContent = {};
            var src = id || copyId;
            notAgain = false;  // clear the publish inhibitor
            editId = id;
            if (src) { // if an id was provided, fetch that book for editing
                bookContent = $.ajax({
                    url: '/book-as-json/',
                    data: {
                        id: src
                    },
                    dataType: 'json'
                });
            }

            $(function() {
                var uploader = new fileuploader.FileUploader({
                    element: $('.file-uploader').get(0),
                    action: '/upload-image/',
                    allowedExtensions: ['jpg', 'png', 'jpeg', 'gif'],
                    sizeLimit: 10 * 1024 * 1024,
                    onComplete: function(id, fileName, response) {
                        //console.log('upload complete', id, fileName, response);
                        if (response.success) {
                            var page = {
                                url: response.url.replace(/.*\/uploads/, '/uploads'),
                                width: response.width,
                                height: response.height,
                                text: ''
                            };
                            addPage(page, false);
                        }
                    },
                    template: $('.wUploader').html(),
                    fileTemplate: $('.wUploaderLi').html()
                });
            });
            setupGallery();
            // click shouldn't trigger edit dialog when dragging and dropping pages
            $('.write-pages').on('mouseup', 'li:not(.ui-sortable-helper)', editPage);
            $('.write-pages').sortable({
                change: setModified
            });
            $('.active-page .thr-well-icon img').on('click', confirmLeaving);
            $('.save').on('click', saveAsDraft);
            $('.publish').on('click', publish);
            $('.categorizeButton').on('click', function() {
                $('.step3a').toggle();
            });
            if ($('input[name=imagefile]').attr('disabled')) {
                $('.step1a').hide();
            }

            $.when(bookContent).then(function(book) {
                if (book.ID) { // editing an existing book
                    initializeBookState(book);
                }
                if ($('.notLoggedIn').length === 0) {
                    $('.writing-controls').show();
                }
            });
        }

        route.add('init', /^\/write\/(?:\?id=(\d+)|\?copy=(\d+))?$/, writeInit);
    }
);
