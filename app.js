/*global $, Backbone, _*/
(function () {
    "use strict";

    var template = _.template("<td class='b-backtable__td'><div class='b-checkbox'><div class='b-checkbox__option'></div></div></td><td class='b-backtable__td'><%= acctid%></td><td class='b-backtable__td'><%= calldate%></td><td class='b-backtable__td'><%= src%></td><td class='b-backtable__td'><%= dst%></td><td class='b-backtable__td'><%= duration%></td><td class='b-backtable__td'><%= billsec%></td><td class='b-backtable__td'><%= disposition%></td><td class='b-backtable__td'><%= userfield%></td>"),
        headerRow = _.template($('#template-header-row').html());

    var BackTableRow = Backbone.View.extend({
        tagName: 'tr',
        className: 'b-backtable__tr',
        initialize: function () {
            // Подписываемся на изменение модели
            this.model.bind('remove', this.remove, this);
            this.model.bind('change', this.reRender, this);
            this.model.bind('render', this.render, this);
            this.model.bind('update', this.update, this);
            this.model.bind('checkedItem', this.onChecked, this);
            $(this.el).attr('tabindex', 0);
        },
        // Перерисовать элемнт [change, redraw]
        reRender: function () {
            console.warn('changeITEM');
            $(this.el).html(clients_tag.getTemplate('item', this.model));
        },
        show: function () {
            $(this.el).show();
        },
        // Отрисовка элемента
        render: function (on) {
            // TODO: Проверить: отсоединяются ли события после empty
            $(this.el).empty();
            /* NEW */
            $(this.el).html(template(this.model.toJSON()));
            //$(this.el).bind('mouseenter mouseleave focusin focusout', this.onHover);a
            $(this.el).bind('click', $.proxy(this.click, this));
            $(this.el).bind('keypress', $.proxy(this.keypress, this));
            $(this.el).toggleClass('update', !!this.model.update);
            //this.onChecked();
            return this;
        },
        // Удалить элемент
        remove: function () {
            $(this.el).empty().remove();
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
            this.parent.collection.on('sync', _.bind(this.changeSorting, this));

            this.render();
            return this;
        },
        render: function () {
            var self = this;

            // TODO: использовать компонент LCheckbox
            this.$el.append($("<th class='b-backtable__th'><div class='b-checkbox'><div class='b-checkbox__option'></div></div></th>"));

            this.$els = {};
            _.each(this.columns, function (column, index) {
                var element;
                column['sorting'] = column.sorting || (_.isUndefined(column.sorting) && this.parent.options.sorting);
                element = $(headerRow(_.extend(column, {index: index})));
                this.$el.append(element);
                if (column.sorting) {
                    // Запишим хеш колонки сортировки
                    this.$els[column.name] = {
                        th: element,
                        span: $('.b-backtable__arrow', element)
                    };
                    element.bind('click', _.bind(this.sorting, this));
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
            }

            this.sort = {
                direction: this.parent.collection.state['order'],
                sortKey: sortKey,
                current: (!this.sort.current || this.sort.current.th.data('sorting') !== sortKey) ? this.$els[sortKey] : this.sort.current
            };

            this.sort.current.span.setMod('direction', this.sort.direction === 1 ? 'up' : 'down');
            return true;
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
            this.listenTo(this.collection, 'add', this._add);
            this.listenTo(this.collection, 'remove', this._remove);
            this.listenTo(this.collection, 'reset', this._reset);

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
                model: model
            });
            this.list[model.cid].render();
            // Положим вьювер в таблицу
            this.$els['content'].append(this.list[model.cid].el);
        },
        _remove: function () {
            console.log('remove', arguments);
        },
        _reset: function (models) {
            console.log('reset', models);
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

    var Model = Backbone.Model.extend({
        idAttribute: 'acctid'
    });
    var Collection = Backbone.PageableCollection.extend({
        url: '/api/sip_cdr/list',
        model: Model,
        mode: 'server',
        state: {
            firstPage: 0,
            pageSize: 25
        },
        parse: function (response) {
            // TODO: Добавить обработку неправильного ответа
            this.state = this._checkState(_.extend({}, this.state, {
                currentPage: response.state.page,
                pageSize: response.state.per_page,
                //totalPages: 25,
                totalRecords: response.state.total_entries,
                sortKey: response.state.sort_by,
                order: response.state.order === 'asc' ? -1 : 1
            }));
            return response['sip_cdr'] || '';
        }
    });

    $(document).ready(function () {
        var collection = new Collection(),
            bt = new BackTable({
                el: $('.b-backtable'),
                collection: collection,
                userSelect: true,
                sorting: false,
                checkbox: true,
                columns: [
                    {
                        name: 'acctid',
                        label: 'ID',
                        sorting: true
                    },
                    {
                        name: 'calldate',
                        label: 'calldate'
                    },
                    {
                        name: 'src',
                        label: 'src',
                        sorting: true
                    },
                    {
                        name: 'dst',
                        label: 'dst'
                    },
                    {
                        name: 'duration',
                        label: 'duration'
                    },
                    {
                        name: 'billsec',
                        label: 'billsec',
                        sorting: true
                    },
                    {
                        name: 'disposition',
                        label: 'disposition',
                        sorting: true
                    },
                    {
                        name: 'userfield',
                        label: 'userfield',
                        sorting: true
                    }
                ]
            });
        console.log('Ready', bt);
        collection.fetch({reset: true});
    });
})();