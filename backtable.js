/*global $, Backbone, _*/
(function (root) {
    "use strict";

    var BackTableRow = Backbone.View.extend({
        tagName: 'tr',
        className: 'b-backtable__tr',
        options: {
            template: _.template("<td class='b-backtable__td'><input type='checkbox'></td><td class='b-backtable__td'><%= acctid%></td><td class='b-backtable__td'><%= calldate%></td><td class='b-backtable__td'><%= src%></td><td class='b-backtable__td'><%= dst%></td><td class='b-backtable__td'><%= duration%></td><td class='b-backtable__td'><%= billsec%></td><td class='b-backtable__td'><%= disposition%></td><td class='b-backtable__td'><%= userfield%></td>")
        },
        initialize: function (options) {
            this.parent = options.parent;
            this.options = _.extend({}, options, this.options);
            // Подписываемся на изменение модели
            this.listenTo(this.model, 'remove', this.remove)
                .listenTo(this.model, 'change', this.reRender)
                .listenTo(this.model, 'render', this.render)
                .listenTo(this.model, 'update', this.update)
                .listenTo(this.model, 'checkedItem', this.onChecked);
            return this;
        },
        // Перерисовать элемнт [change, redraw]
        reRender: function () {
            // TODO: Сделать перерисовку модели
        },
        click: function () {
            if (!event.ctrlKey && !$(event.target).is('span.checkbox-icon') && !$(event.target).is('td.first')) {
                this.parent.collection.checkedToggle(false);
            }
            this.model.checked = !this.model.checked;
            this.parent.collection.checkedSet(this.model.checked);
            this.onChecked(true);
        },
        onChecked: function (focus) {
            if (this.model.checked) {
                this.$el.addClass(this.parent.getCss('checked'));
                this.$check.change('checked', !focus);
            } else {
                this.$el.removeClass(this.parent.getCss('checked'));
                this.$check.change('unchecked', !focus);
            }
        },
        show: function () {
            this.$el.show();
        },
        // Отрисовка элемента
        render: function () {
            this.$el
                .empty()
                .attr('tabindex', 0)
                .bind({
                    'click': $.proxy(this.click, this),
                    'keypress': $.proxy(this.keypress, this)
                })
                // Class для обновления
                .toggleClass('update', !!this.model.update);
            if (this.options['template'] && _.isFunction(this.options['template'])) {
                this.$el.html(this.options['template'](this.model.toJSON()))
            }
            this.$check = $('input[type="checkbox"]', this.$el).lcheck().data('checkbox');
            return this;
        },
        // Удалить элемент
        remove: function () {
            if (this.model.checked) {
                this.model.checked = !this.model.checked;
                this.parent.collection.checkedSet(this.model.checked);
            }
            this.$el.empty().remove();
            this.stopListening();
            delete this.parent;
        }
    });
    var BackTableHeader = Backbone.View.extend({
        tagName: 'tr',
        sort: {
            current: undefined,
            currentField: undefined,
            direction: 0
        },
        initialize: function (options) {
            this.columns = options.columns;
            this.parent = options.parent;

            this.listenTo(this.parent.collection, 'checked' , this.changeSelected)
                .listenTo(this.parent.collection, 'sync' , this.changeSorting);

            this.render();
            return this;
        },
        render: function () {
            var self = this;

            if (this.parent.options.checkbox) {
                this.$check = $(document.createElement('input'))
                    .attr('type', 'checkbox')
                    .appendTo($(document.createElement('th')).addClass(this.parent.getCss('th')).appendTo(this.$el))
                    .lcheck()
                    .bind('lcheck', function (e, checked) {
                        self.parent.collection.checkedToggle(checked === 'checked');
                    });
            }

            this.$els = {};
            _.each(this.columns, function (column, index) {
                var $element,
                    $span;
                column['sorting'] = column.sorting || (_.isUndefined(column.sorting) && this.parent.options.sorting);
                $element = $(document.createElement('th')).addClass(this.parent.getCss('th')).text(column.label || column.name);
                this.$el.append($element);
                if (column.sorting) {
                    $element.setMod('sorting').data('sorting', column.name);
                    $span = $(document.createElement('span')).addClass(this.parent.getCss('arrow')).appendTo($element);
                    // Запишим хеш колонки сортировки
                    this.$els[column.name] = {
                        th: $element,
                        span: $span
                    };
                    $element.bind('click', _.bind(this.sorting, this));
                }
            }, this);
            return this;
        },
        sorting: function (e) {
            var sortKey = $(e.target).data('sorting'),
                order;
            if (!sortKey) {
                return false;
            }
            order = (!this.sort.current || this.sort.current.th.data('sorting') !== sortKey) ? -1 : -this.sort.direction;
            this.parent.collection.setSorting(sortKey, order, {full: true}).fetch();

            return true;
        },
        changeSorting: function () {
            var sortKey = this.parent.collection.state['sortKey'];
            if (!sortKey) {
                return false;
            }

            // Удаляем струлку у текущего столбца сортировки, если конечно есть
            if (this.sort.current) {
                this.sort.current.span.removeClass(this.parent.getCss('directionAsc'));
                this.sort.current.span.removeClass(this.parent.getCss('directionDesc'));
                this.sort.current.th.removeClass(this.parent.getCss('order'));
            }

            this.sort = {
                direction: this.parent.collection.state['order'],
                sortKey: sortKey,
                current: (!this.sort.current || this.sort.current.th.data('sorting') !== sortKey) ? this.$els[sortKey] : this.sort.current
            };

            this.sort.current.span.addClass(this.parent.getCss(this.sort.direction === -1 ? 'directionAsc' : 'directionDesc'));
            this.sort.current.th.addClass(this.parent.getCss('order'));
            return true;
        },
        changeSelected: function (count) {
            if (count > 0) {
                if (count === this.parent.collection.length) {
                    this.$check.data('checkbox').change('checked', true, true);
                } else {
                    this.$check.data('checkbox').change('indeterminate', true, true);
                }
            } else {
                this.$check.data('checkbox').change('unchecked', true, true);
            }
        }
    });
    var BackTable = Backbone.View.extend({
        options: {
            cssClasses: {
                tr: 'b-backtable__tr',
                td: 'b-backtable__td',
                th: 'b-backtable__th',
                headerTr: 'b-backtable__header',

                header: 'b-backtable__header',
                headerWrap: 'b-backtable__header-wrapper',
                content: 'b-backtable__content',
                contentWrap: 'b-backtable__content-wrapper',

                shadow: 'b-backtable__header_shadow_yes',

                update: 'b-table__tr_state_update',
                checked: 'b-backtable__tr_checked_yes',
                hover: 'b-table__tr_hover_yes',

                order: 'b-backtable__th_order_yes',
                sorting: 'b-backtable__th_sorting_yes',

                arrow: 'b-backtable__arrow',
                directionAsc: 'b-backtable__arrow_direction_asc',
                directionDesc: 'b-backtable__arrow_direction_desc',

                colSize: 'b-backtable__col_size_',
                colSizeDefault: 'b-backtable__col_size_min',
                colSizeCheckbox: 'b-backtable__col_size_checkbox'
            },
            columns: [],
            checkbox: true,
            // TODO: issue #8
            userSelect: true,
            sorting: false,
            heightMode: 'auto',
            height: '300',
            heightAdditional: 5,
            scrollbarAdditionalWidth: 5
        },
        tagName: 'div',
        className: 'b-backtable',
        collection: undefined,
        /**
         * @constructor
         */
        initialize: function (options) {
            if (options.cssClasses) {
                this.options.cssClasses = _.extend({}, this.options.cssClasses, options['cssClasses']);
                delete options.cssClasses;
            }
            this.options = _.extend({}, this.options, options);

            this.list = [];

            this.listenTo(this.collection, 'add', this._add)
                .listenTo(this.collection, 'remove', this._remove)
                .listenTo(this.collection, 'reset', this._reset)
                .listenTo(this.collection, 'checked', this.disableControls);

            this.header = new BackTableHeader({columns: options.columns, checkbox: this.options.checkbox, parent: this});
            return this;
        },
        getCss: function (name) {
            return this.options.cssClasses[name]
        },
        /**
         *
         */
        render: function () {
            if (this._rendered) {
                return this;
            }
            this.$els = {
                'header-wrapper': $(document.createElement('div')).addClass(this.getCss('headerWrap')).appendTo(this.$el),
                'content-wrapper': $(document.createElement('div')).addClass(this.getCss('contentWrap')).appendTo(this.$el)
            };
            _.extend(this.$els, {
                'colgroup': this._renderColGroup(),
                'header': $(document.createElement('table')).addClass(this.getCss('header')).appendTo(this.$els['header-wrapper']),
                'content': $(document.createElement('table')).addClass(this.getCss('content')).appendTo(this.$els['content-wrapper'])
            });

            // Вставляем стили колонок
            this.$els.colgroup.clone().prependTo(this.$els.content);
            this.$els.colgroup.clone().prependTo(this.$els.header);

            // Добавляем загаловок
            $(document.createElement('thead')).appendTo(this.$els['header']);
            this.$els['header'].children('thead').append(this.header.$el);

            this._rendered = true;
            return this;
        },
        appendTo: function ($to){
            this.$el.appendTo($to);
            this._calcTableSize();
        },
        append: function ($to){
            $to.append(this.$el);
            this._calcTableSize();
        },
        /**
         * Подсчёт
         * @private
         */
        _calcTableSize: function () {
            // Высчитываем ширину колонки
            this.options.scrollbarWidth = this._getScrollbarWidth() + this.options.scrollbarAdditionalWidth;
            if (this.options['heightMode'] === 'fixed') {
                this.$els['content-wrapper'].bind('scroll', _.debounce($.proxy(this.wrapperScroll, this), 40));
                this.resize(this.options['width'] || this.$els['content-wrapper'].width() - this.options.scrollbarWidth, this.options['height']);
            }
            if (this.options['heightMode'] === 'full') {
                this.$els['content-wrapper'].bind('scroll', _.debounce($.proxy(this.wrapperScroll, this), 40));
                $(window).bind('resize', _.debounce($.proxy(this.resizeWindow, this), 40));
                this.resizeWindow();
            }
        },
        /**
         * Создаём ColGroup исходя из колонок (+ добавляем колонку если используется выделение элементов)
         * 1. Если есть style у колонки то добавляем стиль [colSize + style] ~ "b-backtable__col_size_" + "checkbox"
         * 2. В ином случае используем размер по умолчанию
         *
         * @returns {*|jQuery|HTMLElement}
         * @private
         */
        _renderColGroup: function () {
            var $colgroup = $(document.createElement('colgroup')),
                columns = this.options.checkbox ? [{style: 'checkbox'}].concat(this.options.columns) : this.options.columns;
            _.each(columns, function (col) {
                $(document.createElement('col'))
                    .addClass(col.style ? this.getCss('colSize') + col.style : this.getCss('colSizeDefault'))
                    .appendTo($colgroup);
            }, this);
            return $colgroup;
        },
        /**
         * Добавление
         *
         * @param model
         * @private
         */
        _add: function (model) {
            console.log('add', model);
            this.list[model.cid] = new BackTableRow({
                parent: this,
                model: model
            });
            this.list[model.cid].render();
            // Положим вьювер в таблицу
            this.$els['content'].append(this.list[model.cid].el);
        },
        /**
         *
         * @returns {boolean}
         * @private
         */
         _remove: function () {
            console.log('remove', arguments);
            return false;
        },
        /**
         *
         * @param models
         * @private
         */
        _reset: function (models) {
            console.log('** >> reset', models);
            models.each(function (model) {
                this._add(model);
            }, this);
        },
        wrapperScroll: function () {
            // Добавляем стиль к шапке если мы перемотали список вниз
            if (this.$els['content-wrapper'].scrollTop() > 0 && !this._shadowEnable) {
                this.$els['header'].addClass(this.getCss('shadow'));
                this._shadowEnable = true;
            }
            if (this.$els['content-wrapper'].scrollTop() === 0 && this._shadowEnable) {
                this.$els['header'].removeClass(this.getCss('shadow'));
                this._shadowEnable = false;
            }
        },
        resizeWindow: function () {
            var height = $(window).height() - this.$els['content-wrapper'].offset().top - this.$els['content-wrapper'].css("padding-top").replace("px", "") - this.options['heightAdditional'],
                width = this.$els['content-wrapper'].width() - this.options.scrollbarWidth;
            this.resize(width, height);
            this.wrapperScroll();
        },
        resize: function (width, height) {
            this.$els['header'].css('width', width);
            this.$els['content']
                .css('margin-top', this.$els['header'].height())
                .css('width', width);
            this.$els['content-wrapper'].height(height);
        },
        /**
         * Получить ширину скроллбара
         *
         * @returns Integer
         * @private
         */
        _getScrollbarWidth: function () {
            var $temporary = $(document.createElement('p')).css('width', '100%').css('height', '100%'),
                width = this.$els['content-wrapper'].width();
            this.$els['content-wrapper'].append($temporary);
            width = width - this.$els['content-wrapper'].width();
            $temporary.remove();
            return width;
        }
    });

    var BackTableModel = Backbone.Model.extend({
        checked: false,
        checkedSet: function (on, silent) {
            if (on !== this.checked) {
                this.checked = on;
                if (!silent) { this.trigger('checkedItem'); }
            }
        }
    });
    var BackTableCollection = Backbone.PageableCollection.extend({
        /**
         * Переключение всех моделей в режим выбрано/не выбрано
         *
         * @param bool
         */
        checkedToggle: function (bool) {
            this.each(function (item) {
                item.checkedSet(bool);
            }, this);
            this.checkedCount = (bool) ? this.length : 0;
            this.trigger('checked', this.checkedCount);
        },
        /**
         * Подсчёт выбранных элементов
         *
         * @param bool Boolean
         * @param silent Boolean Тихий режим
         */
        checkedSet: function (bool, silent) {
            console.log('> checked count', this.checkedCount, bool);
            (bool) ? this.checkedCount++ : this.checkedCount--;
            console.log('>> checked count', this.checkedCount, bool);
            if (!silent) {
                this.trigger('checked', this.checkedCount);
            }
        },
        /**
         * Получить все выюранные модели
         */
        getChecked: function () {
            return this.filter(function (model) {
                return model.checked;
            });
        }
    });


    root.BackTable = BackTable;
    root.BackTableCollection = BackTableCollection;
    root.BackTableModel = BackTableModel;
})(this);