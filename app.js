/*global $, Backbone, _*/
(function () {
    "use strict";
    var BackTable = Backbone.View.extend({
        options: {
            colums: [],
            test: ''
        },
        /**
         * @constructor
         */
        initialize: function () {
            console.log('initialize test');
            this.render();
        },
        render: function () {
            this.$els = {
                'header-wrapper': this.$el.elem('header-wrapper'),
                'header': this.$el.elem('header'),
                'content-wrapper': this.$el.elem('content-wrapper'),
                'content': this.$el.elem('content')
            };

            this.$els['content-wrapper'].bind('scroll', _.debounce($.proxy(this.wrapperScroll, this), 40));
            $(window).bind('resize', _.debounce($.proxy(this.resizeWindow, this), 40));
            this.resizeWindow();
        },
        wrapperScroll: function () {
            // Добавляем стиль к шапке если мы перемотали список вниз
            if (this.$els['content-wrapper'].scrollTop() > 0 && !this._shadowEnable) {
                this.$els['header'].setMod('shadow');//.addClass('shadow');
                this._shadowEnable = true;
            }
            if (this.$els['content-wrapper'].scrollTop() === 0 && this._shadowEnable) {
                this.$els['header'].delMod('shadow');
                this._shadowEnable = false;
            }
            // Если мы приближаймся к концу списка то покажем ещё элементов
            /*if (this.options.wraper.scrollTop() + 50 >= this.$el.height() - this.options.wraper.height()) {
                this.showNew();
            }*/
        },
        resizeWindow: function () {
            var height = $(window).height() - this.$els['content-wrapper'].offset().top - this.$els['content-wrapper'].css("padding-top").replace("px", "") - 5,
                width = this.$els['content-wrapper'].width() - 35;
            this.$els['header'].css('width', width);
            this.$els['content']
                .css('margin-top', this.$els['header'].height())
                .css('width', width);
            this.$els['content-wrapper'].height(height);
            this.wrapperScroll();
        }
    });

    $(document).ready(function () {
        var bt = new BackTable({el: $('.b-backtable')});
        console.log('Ready', bt);

    });
})();