/*global $, Backbone, _*/
(function (root) {
    "use strict";

    var template = _.template("<td class='b-backtable__td'><input type='checkbox'></td><td class='b-backtable__td'><%= acctid%></td><td class='b-backtable__td'><%= calldate%></td><td class='b-backtable__td'><%= src%></td><td class='b-backtable__td'><%= dst%></td><td class='b-backtable__td'><%= duration%></td><td class='b-backtable__td'><%= billsec%></td><td class='b-backtable__td'><%= disposition%></td><td class='b-backtable__td'><%= userfield%></td>");

    var BackTableRow = Backbone.View.extend({
        tagName: 'tr',
        className: 'b-backtable__tr',
        initialize: function (options) {
            this.parent = options.parent;
            // Подписываемся на изменение модели
            this.listenTo(this.model, 'remove', this.remove)
                .listenTo(this.model, 'change', this.reRender)
                .listenTo(this.model, 'render', this.render)
                .listenTo(this.model, 'update', this.update)
                .listenTo(this.model, 'checkedItem', this.onChecked);
            this.$el.attr('tabindex', 0);
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
                this.$el.setMod('checked', 'yes');
                this.$check.change('checked', !focus);
            } else {
                this.$el.delMod('checked', 'yes');
                this.$check.change('unchecked', !focus);
            }
        },
        show: function () {
            this.$el.show();
        },
        // Отрисовка элемента
        render: function (on) {
            this.$el
                .empty()
                .html(template(this.model.toJSON()))
                .bind({
                    'click': $.proxy(this.click, this),
                    'keypress': $.proxy(this.keypress, this)
                })
                // Class для обновления
                .toggleClass('update', !!this.model.update);

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
        className: 'backtable__header-tr',
        sort: {
            current: undefined,
            currentField: undefined,
            direction: 0
        },
        initialize: function (options) {
            this.columns = options.columns;
            this.parent = options.parent;
            //this.parent.collection.on('sync', _.bind(this.changeSorting, this));

            this.listenTo(this.parent.collection, 'checked' , this.changeSelected)
                .listenTo(this.parent.collection, 'sync' , this.changeSorting);

            this.render();
            return this;
        },
        render: function () {
            var self = this;

            if (this.parent.options.checkbox) {
                this.$el.append($("<th class='b-backtable__th'><input type='checkbox'></th>"));
                this.$check = this.$('input[type="checkbox"]').lcheck();
                this.$check.bind('lcheck', function (e, checked) {
                    self.parent.collection.checkedToggle(checked === 'checked');
                });
                //console.log('>>', this.$check, this.$check.data('checkbox').change);
            }

            this.$els = {};
            _.each(this.columns, function (column, index) {
                var $element,
                    $span;
                column['sorting'] = column.sorting || (_.isUndefined(column.sorting) && this.parent.options.sorting);
                $element = $("<th class='b-backtable__th'></th>").text(column.label || column.name);
                this.$el.append($element);
                if (column.sorting) {
                    $element.setMod('sorting').data('sorting', column.name);
                    $span = $('<span class="b-backtable__arrow"></span>').appendTo($element);
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
                this.sort.current.span.delMod('direction');
                this.sort.current.th.delMod('order');
            }

            this.sort = {
                direction: this.parent.collection.state['order'],
                sortKey: sortKey,
                current: (!this.sort.current || this.sort.current.th.data('sorting') !== sortKey) ? this.$els[sortKey] : this.sort.current
            };

            this.sort.current.span.setMod('direction', this.sort.direction === 1 ? 'up' : 'down');
            this.sort.current.th.setMod('order');
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
            columns: [],
            checkbox: true,
            // TODO: issue #8
            userSelect: true,
            // TODO: issue #9
            sorting: false
        },
        collection: undefined,
        /**
         * @constructor
         */
        initialize: function (options) {
            _.extend(this.options, options);
            this.list = [];
            console.log('initialize test', this.collection, arguments);
            //this.collection.bind()
            this.listenTo(this.collection, 'add', this._add)
                .listenTo(this.collection, 'remove', this._remove)
                .listenTo(this.collection, 'reset', this._reset)
                .listenTo(this.collection, 'checked', this.disableControls);

            this.header = new BackTableHeader({columns: options.columns, checkbox: this.options.checkbox, parent: this});

            this.render();
        },

        render: function () {
            this.$els = {
                'header-wrapper': this.$el.elem('header-wrapper'),
                'header': this.$el.elem('header'),
                'content-wrapper': this.$el.elem('content-wrapper'),
                'content': this.$el.elem('content')
            };
            console.log(this.header.$el);
            this.$els['header'].children('thead').append(this.header.$el);

            this.$els['content-wrapper'].bind('scroll', _.debounce($.proxy(this.wrapperScroll, this), 40));
            $(window).bind('resize', _.debounce($.proxy(this.resizeWindow, this), 40));
            this.resizeWindow();
        },

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
         _remove: function () {
            console.log('remove', arguments);
            return false;
        },
        _reset: function (models) {
            console.log('** >> reset', models);
            models.each(function (model) {
                this._add(model);
            }, this);
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
        }
    });


    root.BackTable = BackTable;
    root.BackTableCollection = BackTableCollection;
    root.BackTableModel = BackTableModel;
})(this);