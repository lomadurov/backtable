/*global $, Backbone, _, module, require, define*/
(function (factory) {

    // CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require("underscore"), require("backbone"));
    }
    // AMD
    else if (typeof define == "function" && define.amd) {
        define(["underscore", "backbone"], factory);
    }
    // Browser
    else if (typeof _ !== "undefined" && typeof Backbone !== "undefined") {
        _.each(factory(_, Backbone), function (m, name) {
            Backbone[name] = m;
        });
    }

}(function (_, Backbone) {
    "use strict";
    var PageHandle = Backbone.View.extend({

        /** @property */
        tagName: "li",

        /** @property */
        events: {
            "click a": "changePage"
        },

        /**
         @property {string|function(Object.<string, string>): string} title
         The title to use for the `title` attribute of the generated page handle
         anchor elements. It can be a string or an Underscore template function
         that takes a mandatory `label` parameter.
         */
        title: _.template('Page <%- label %>', null, {variable: null}),

        /**
         @property {boolean} isRewind Whether this handle represents a rewind
         control
         */
        isRewind: false,

        /**
         @property {boolean} isBack Whether this handle represents a back
         control
         */
        isBack: false,

        /**
         @property {boolean} isForward Whether this handle represents a forward
         control
         */
        isForward: false,

        /**
         @property {boolean} isFastForward Whether this handle represents a fast
         forward control
         */
        isFastForward: false,

        /**
         Initializer.

         @param {Object} options
         @param {Backbone.Collection} options.collection
         @param {number} pageIndex 0-based index of the page number this handle
         handles. This parameter will be normalized to the base the underlying
         PageableCollection uses.
         @param {string} [options.label] If provided it is used to render the
         anchor text, otherwise the normalized pageIndex will be used
         instead. Required if any of the `is*` flags is set to `true`.
         @param {string} [options.title]
         @param {boolean} [options.isRewind=false]
         @param {boolean} [options.isBack=false]
         @param {boolean} [options.isForward=false]
         @param {boolean} [options.isFastForward=false]
         */
        initialize: function (options) {
            var collection = this.collection;
            var state = collection.state;
            var currentPage = state.currentPage;
            var firstPage = state.firstPage;
            var lastPage = state.lastPage;

            _.extend(this, _.pick(options,
                ["isRewind", "isBack", "isForward", "isFastForward"]));

            var pageIndex;
            if (this.isRewind) pageIndex = firstPage;
            else if (this.isBack) pageIndex = Math.max(firstPage, currentPage - 1);
            else if (this.isForward) pageIndex = Math.min(lastPage, currentPage + 1);
            else if (this.isFastForward) pageIndex = lastPage;
            else {
                pageIndex = +options.pageIndex;
                pageIndex = (firstPage ? pageIndex + 1 : pageIndex);
            }
            this.pageIndex = pageIndex;

            this.label = (options.label || (firstPage ? pageIndex : pageIndex + 1)) + '';
            var title = options.title || this.title;
            this.title = _.isFunction(title) ? title({label: this.label}) : title;
        },

        /**
         Renders a clickable anchor element under a list item.
         */
        render: function () {
            this.$el.empty();
            var anchor = document.createElement("a");
            anchor.href = '#';
            if (this.title) anchor.title = this.title;
            anchor.innerHTML = this.label;
            this.el.appendChild(anchor);

            var collection = this.collection;
            var state = collection.state;
            var currentPage = state.currentPage;
            var pageIndex = this.pageIndex;

            if (this.isRewind && currentPage == state.firstPage ||
                this.isBack && !collection.hasPrevious() ||
                this.isForward && !collection.hasNext() ||
                this.isFastForward && (currentPage == state.lastPage || state.totalPages < 1)) {
                this.$el.addClass("disabled");
            }
            else if (!(this.isRewind ||
                this.isBack ||
                this.isForward ||
                this.isFastForward) &&
                state.currentPage == pageIndex) {
                this.$el.addClass("active");
            }

            this.delegateEvents();
            return this;
        },

        /**
         jQuery click event handler. Goes to the page this PageHandle instance
         represents. No-op if this page handle is currently active or disabled.
         */
        changePage: function (e) {
            e.preventDefault();
            var $el = this.$el, col = this.collection;
            if (!$el.hasClass("active") && !$el.hasClass("disabled")) {
                if (this.isRewind) col.getFirstPage();
                else if (this.isBack) col.getPreviousPage();
                else if (this.isForward) col.getNextPage();
                else if (this.isFastForward) col.getLastPage();
                else col.getPage(this.pageIndex, {reset: true});
            }
            return this;
        }

    });

    /**
     Paginator is a Backgrid extension that renders a series of configurable
     pagination handles. This extension is best used for splitting a large data
     set across multiple pages. If the number of pages is larger then a
     threshold, which is set to 10 by default, the page handles are rendered
     within a sliding window, plus the rewind, back, forward and fast forward
     control handles. The individual control handles can be turned off.

     @class Backgrid.Extension.Paginator
     */
    var Pagination = Backbone.View.extend({

        /** @property */
        className: "b-pagination",

        /** @property */
        windowSize: 10,

        /**
         @property {number} slideScale the number used by #slideHowMuch to scale
         `windowSize` to yield the number of pages to slide. For example, the
         default windowSize(10) * slideScale(0.5) yields 5, which means the window
         will slide forward 5 pages as soon as you've reached page 6. The smaller
         the scale factor the less pages to slide, and vice versa.

         Also See:

         - #slideMaybe
         - #slideHowMuch
         */
        slideScale: 0.5,

        /**
         @property {Object.<string, Object.<string, string>>} controls You can
         disable specific control handles by setting the keys in question to
         null. The defaults will be merged with your controls object, with your
         changes taking precedent.
         */
        controls: {
            rewind: {
                label: "《",
                title: "First"
            },
            back: {
                label: "〈",
                title: "Previous"
            },
            forward: {
                label: "〉",
                title: "Next"
            },
            fastForward: {
                label: "》",
                title: "Last"
            }
        },

        /** @property */
        renderIndexedPageHandles: true,

        /**
         @property {Backgrid.Extension.PageHandle} pageHandle. The PageHandle
         class to use for rendering individual handles
         */
        pageHandle: PageHandle,

        /** @property */
        goBackFirstOnSort: true,

        /**
         Initializer.

         @param {Object} options
         @param {Backbone.Collection} options.collection
         @param {boolean} [options.controls]
         @param {boolean} [options.pageHandle=Backgrid.Extension.PageHandle]
         @param {boolean} [options.goBackFirstOnSort=true]
         */
        initialize: function (options) {
            var self = this;
            self.controls = _.defaults(options.controls || {}, self.controls,
                Pagination.prototype.controls);

            _.extend(self, _.pick(options || {}, "windowSize", "pageHandle",
                "slideScale", "goBackFirstOnSort",
                "renderIndexedPageHandles"));

            var col = self.collection;
            self.listenTo(col, "add", self.render);
            self.listenTo(col, "remove", self.render);
            self.listenTo(col, "reset", self.render);
            self.listenTo(col, "sorted", function () {
                if (self.goBackFirstOnSort) col.getFirstPage({reset: true});
            });
        },

        /**
         Decides whether the window should slide. This method should return 1 if
         sliding should occur and 0 otherwise. The default is sliding should occur
         if half of the pages in a window has been reached.

         __Note__: All the parameters have been normalized to be 0-based.

         @param {number} firstPage
         @param {number} lastPage
         @param {number} currentPage
         @param {number} windowSize
         @param {number} slideScale

         @return {0|1}
         */
        slideMaybe: function (firstPage, lastPage, currentPage, windowSize, slideScale) {
            return Math.round(currentPage % windowSize / windowSize);
        },

        /**
         Decides how many pages to slide when sliding should occur. The default
         simply scales the `windowSize` to arrive at a fraction of the `windowSize`
         to increment.

         __Note__: All the parameters have been normalized to be 0-based.

         @param {number} firstPage
         @param {number} lastPage
         @param {number} currentPage
         @param {number} windowSize
         @param {number} slideScale

         @return {number}
         */
        slideThisMuch: function (firstPage, lastPage, currentPage, windowSize, slideScale) {
            return ~~(windowSize * slideScale);
        },

        _calculateWindow: function () {
            var collection = this.collection;
            var state = collection.state;

            // convert all indices to 0-based here
            var firstPage = state.firstPage;
            var lastPage = +state.lastPage;
            lastPage = Math.max(0, firstPage ? lastPage - 1 : lastPage);
            var currentPage = Math.max(state.currentPage, state.firstPage);
            currentPage = firstPage ? currentPage - 1 : currentPage;
            var windowSize = this.windowSize;
            var slideScale = this.slideScale;
            var windowStart = Math.floor(currentPage / windowSize) * windowSize;
            if (currentPage <= lastPage - this.slideThisMuch()) {
                windowStart += (this.slideMaybe(firstPage, lastPage, currentPage, windowSize, slideScale) *
                    this.slideThisMuch(firstPage, lastPage, currentPage, windowSize, slideScale));
            }
            var windowEnd = Math.min(lastPage + 1, windowStart + windowSize);
            return [windowStart, windowEnd];
        },

        /**
         Creates a list of page handle objects for rendering.

         @return {Array.<Object>} an array of page handle objects hashes
         */
        makeHandles: function () {

            var handles = [];
            var collection = this.collection;

            var window = this._calculateWindow();
            var winStart = window[0], winEnd = window[1];

            if (this.renderIndexedPageHandles) {
                for (var i = winStart; i < winEnd; i++) {
                    handles.push(new this.pageHandle({
                        collection: collection,
                        pageIndex: i
                    }));
                }
            }

            var controls = this.controls;
            _.each(["back", "rewind", "forward", "fastForward"], function (key) {
                var value = controls[key];
                if (value) {
                    var handleCtorOpts = {
                        collection: collection,
                        title: value.title,
                        label: value.label
                    };
                    handleCtorOpts["is" + key.slice(0, 1).toUpperCase() + key.slice(1)] = true;
                    var handle = new this.pageHandle(handleCtorOpts);
                    if (key == "rewind" || key == "back") handles.unshift(handle);
                    else handles.push(handle);
                }
            }, this);

            return handles;
        },

        /**
         Render the paginator handles inside an unordered list.
         */
        render: function () {
            var i, l;
            this.$el.empty();

            if (this.handles) {
                for (i = 0, l = this.handles.length; i < l; i++) {
                    this.handles[i].remove();
                }
            }

            var handles = this.handles = this.makeHandles();

            var ul = document.createElement("ul");
            for (i = 0; i < handles.length; i++) {
                ul.appendChild(handles[i].render().el);
            }

            this.el.appendChild(ul);

            return this;
        }

    });

    return {
        BackPagination: Pagination,
        BackPageHandle: PageHandle
    }
}));