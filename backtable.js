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

    /**
     * Класс для работы со строкой таблицы
     */
    var BackTableRow = Backbone.View.extend({
        tagName: 'tr',
        model: undefined,
        /**
         * Конструктор
         *
         * @param options
         * @constructor
         * @returns {BackTableRow}
         */
        initialize: function (options) {
            this.parent = options.parent;
            this.options = _.extend({}, options, this.options);
            // Подписываемся на изменение модели
            this.listenTo(this.model, 'destroy', this.remove)
                .listenTo(this.model, 'change', this.reRender)
                .listenTo(this.model, 'update', this.update)
                .listenTo(this.model, 'checkedItem', this.onChecked);
            return this;
        },
        /**
         * Перерисовка строки
         * TODO: Сделать перерисовку модели
         * @returns {BackTableRow}
         */
        reRender: function () {
            return this;
        },
        /**
         * Изменение статуса строки
         * TODO: Изменение статуса строки
         * @returns {BackTableRow}
         */
        update: function () {
            this.$el.toggleClass(this.parent.getCss('update'), !!this.model.update);
            return this;
        },
        /**
         * Нажатие на элемент
         *
         * @param {jQuery.Event} event Событие
         * @param {*} atCheckbox Любое значение != false считается нажатием на первый элемент
         * @returns {boolean}
         */
        click: function (event, atCheckbox) {
            // Выходим если нету чекбоксов
            if (!this.parent || !this.parent.options || !this.parent.options.checkbox) {
                return true;
            }
            // Если зажата клавиша shift, тогда говорим коллекции до какого элемента выделять
            if (event && event.shiftKey && this.parent.collection.lastChecked) {
                this.parent.collection.checkedMany(this.model.id);
            } else {
                // Множественный выбор работает если: зажата клавиша Ctrl, либо действие спровоцировано нажатием на чекбокс
                if (event && !event.ctrlKey && !atCheckbox) {
                    this.parent.collection.checkedToggle(false, true);
                }
                this.model.checked = !this.model.checked;
                this.parent.collection.lastChecked = this.model.id;
                this.parent.collection.checkedSet(this.model.checked);
                this.onChecked(true);
            }
            // Если нажали по классу редактирования
            if ($(event.target).is('a') && $(event.target).hasClass(this.parent.getCss('edit'))) {
                this.parent.collection.trigger('edit');
            }
            return true;
        },
        /**
         * Отрисовка изменения выделения строки
         *
         * @param {boolean} focus
         */
        onChecked: function (focus) {
            if (this.model.checked) {
                this.$el.addClass(this.parent.getCss('checked'));
                this.$check.change('checked', !focus, true);
            } else {
                this.$el.removeClass(this.parent.getCss('checked'));
                this.$check.change('unchecked', !focus, true);
            }
        },
        /**
         * Отрисовка строки
         *
         * @returns {BackTableRow}
         */
        render: function () {
            var _hashToCheckbox,
                self = this;
            this.$el
                .empty()
                .bind({
                    'click': _.bind(this.click, this)
                });
            // Class для обновления
            this.update();
            if (!_.isUndefined(this.parent.options['tabindex'])) {
                this.$el.attr('tabindex', ~~this.parent.options['tabindex']);
            }
            if (this.options['template'] && _.isFunction(this.options['template'])) {
                this.$el.html(this.options['template'](this.model.toJSON()))
            }
            // Отрисовываем чекбокс, если нужно
            if (this.parent.options.checkbox) {
                _hashToCheckbox = $(document.createElement('td'))
                    .addClass(this.parent.getCss('td') + ' ' + this.parent.getCss('checkbox'))
                    .bind('click', _.bind(this.click, this, 'checked'))
                    .prependTo(this.$el);
                this.$check = $(document.createElement('input'))
                    .attr('type', 'checkbox')
                    .lcheck()
                    .data('checkbox');
                this.$check.$span.appendTo(_hashToCheckbox);
                this.$check.$input.bind('lcheck', _.bind(this.click, this));
                if (this.parent.options.checkboxArrow) {
                    this.$check.$span.bind('keydown', function (e) {
                        if (e.keyCode === 40) {
                            e.preventDefault();
                            _hashToCheckbox.parent(), _hashToCheckbox.parent().next().find('span.b-lcheck').focus();
                        }
                        if (e.keyCode === 38) {
                            e.preventDefault();
                            _hashToCheckbox.parent(), _hashToCheckbox.parent().prev().find('span.b-lcheck').focus();
                        }
                    });
                }
                //if (this.parent.options.checkboxFocusClass) {
                this.$check.$span.on('focusin focusout', function (e) {
                    console.log(e);
                    self.$el.toggleClass(self.parent.getCss('focus'), e.type === 'focusin')
                });
                //}
            }
            return this;
        },
        /**
         * Удалить строку из таблицы
         */
        remove: function () {
            if (this.$check) {
                this.$check.$span.remove();
            }
            if (this.model.checked) {
                this.model.checked = !this.model.checked;
                this.parent.collection.checkedSet(this.model.checked);
            }
            this.$el.empty().remove();
            this.stopListening();
            delete this.parent;
        }
    });

    /**
     * Класс для обработки загаловка таблицы
     */
    var BackTableHeader = Backbone.View.extend({
        tagName: 'tr',
        sort: {
            current: undefined,
            currentField: undefined,
            direction: 0
        },
        /**
         * Конструктор
         *
         * @param {Array} options
         * @constructor
         * @returns {BackTableHeader}
         */
        initialize: function (options) {
            this.columns = options['columns'];
            this.parent = options['parent'];

            this.listenTo(this.parent.collection, 'checked' , this.changeSelected)
                .listenTo(this.parent.collection, 'sync', this.changeSorting);

            this.render();
            return this;
        },
        /**
         * Отрисовка колонок загаловка
         *
         * @returns {BackTableHeader}
         */
        render: function () {
            var self = this;

            if (this.parent.options.checkbox) {
                this.$check = $(document.createElement('input'))
                    .attr('type', 'checkbox')
                    .appendTo($(document.createElement('th')).addClass(this.parent.getCss('th')).appendTo(this.$el))
                    .lcheck()
                    .bind('lcheck', function (e, checked) {
                        self.parent.collection.checkedToggle(checked === 'checked', false);
                    });
            }

            this.$els = {};
            _.each(this.columns, function (column) {
                var $element,
                    $span;
                column['sorting'] = column.sorting || (_.isUndefined(column.sorting) && this.parent.options.sorting);
                $element = $(document.createElement('th')).addClass(this.parent.getCss('th')).text(column.label || column.name);
                this.$el.append($element);
                if (column.sorting) {
                    $element.addClass(this.parent.getCss('sorting')).data('sorting', column.name).data('sorting-type', column.type);
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
        /**
         * Меняем направление сортировки и сообщаем коллеции о новом направлении
         *
         * @param {jQuery.Event} event События
         * @returns {boolean}
         */
        sorting: function (event) {
            var sortKey = $(event.target).data('sorting'),
                order,
                sortType;
            if (!sortKey) {
                return false;
            }
            order = (!this.sort.current || this.sort.current.th.data('sorting') !== sortKey) ? -1 : -this.sort.direction;
            sortType = this.sort.current && this.sort.current.th.data('sorting-type') ? this.sort.current.th.data('sorting-type') : 'string';
            this.parent.sort(sortKey, order, sortType);
            this.changeSorting();
            return true;
        },
        /**
         * После подгрузки новых данных в коллекции отрисовываем изменяя в направление сортировки
         *
         * @returns {boolean}
         */
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
        /**
         * Изменить флажок выделения взавиисимости от количества выбранных элементов
         *
         * @param {number} count Количество выделенных элементов
         */
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
    /**
     * Класс отрисовки таблицы
     */
    var BackTable = Backbone.View.extend({
        options: {
            cssClasses: {
                tr: 'b-backtable__tr',
                td: 'b-backtable__td',
                th: 'b-backtable__th',
                headerTr: 'b-backtable__tr',

                header: 'b-backtable__header',
                headerWrap: 'b-backtable__header-wrapper',
                content: 'b-backtable__content',
                contentWrap: 'b-backtable__content-wrapper',

                shadow: 'b-backtable__header_shadow_yes',

                edit: 'b-backtable__edit',

                update: 'b-table__tr_state_update',
                checked: 'b-backtable__tr_checked_yes',
                hover: 'b-table__tr_hover_yes',

                order: 'b-backtable__th_order_yes',
                sorting: 'b-backtable__th_sorting_yes',

                checkbox: 'b-backtable__td_type_checkbox',
                focus: 'b-backtable__tr_focus_yes',

                arrow: 'b-backtable__arrow',
                directionAsc: 'b-backtable__arrow_direction_asc',
                directionDesc: 'b-backtable__arrow_direction_desc',

                colSize: 'b-backtable__col_size_',
                colSizeDefault: 'b-backtable__col_size_min',
                colSizeCheckbox: 'b-backtable__col_size_checkbox'
            },
            columns: [],
            autoResize: true,
            checkbox: true,
            checkboxArrow: true,
            checkboxFocusClass: true,
            // TODO: issue #8
            userSelect: true,
            sorting: false,
            heightMode: 'auto',
            row: BackTableRow,
            height: '300',
            heightAdditional: 5,
            scrollbarAdditionalWidth: 5
        },
        tagName: 'div',
        className: 'b-backtable',
        collection: undefined,
        /**
         * Конструктор
         *
         * @constructor
         * @param {array} options Опции
         * @returns {BackTable}
         */
        initialize: function (options) {
            if (options['cssClasses']) {
                this.options.cssClasses = _.extend({}, this.options.cssClasses, options['cssClasses']);
                delete options['cssClasses'];
            }
            this.options = _.extend({}, this.options, options);

            this.list = [];

            this.listenTo(this.collection, 'add', this._add)
                .listenTo(this.collection, 'remove', this._remove)
                .listenTo(this.collection, 'sort', this._sort)
                .listenTo(this.collection, 'reset', this._reset);

            this.header = new BackTableHeader({className: this.getCss('headerTr'), columns: options['columns'], checkbox: this.options.checkbox, parent: this});

            this.on('resize', _.bind(this.resizeWindow, this));

            return this;
        },
        /**
         * Получить класс стилей по имени
         *
         * @param {string} name Имя класса
         * @returns {string}
         */
        getCss: function (name) {
            return this.options.cssClasses[name] || ''
        },
        /**
         * Отрисовка элемента
         *
         * @returns {BackTable}
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
        /**
         * Поместить данный элемнт в контейнер последним
         *
         * @param {jQuery} $to куда
         * @returns {BackTable}
         */
        appendTo: function ($to){
            this.$el.appendTo($to);
            this._calcTableSize();
            return this;
        },
        /**
         * Поместить данный элемнт в контейнер первым
         *
         * @param {jQuery} $to куда
         * @returns {BackTable}
         */
        prependTo: function ($to) {
            this.$el.prependTo($to);
            this._calcTableSize();
            return this;
        },
        /**
         * Подсчёт размера таблицы
         *
         * @private
         * @returns {BackTable}
         */
        _calcTableSize: function () {
            var self = this;
            // Высчитываем ширину колонки
            this.options.scrollbarWidth = this._getScrollbarWidth() + this.options.scrollbarAdditionalWidth;
            if (this.options['heightMode'] === 'fixed') {
                this.$els['content-wrapper'].bind('scroll', _.debounce(_.bind(this.wrapperScroll, this), 40));
                this.resize(this.options['width'] || this.$els['content-wrapper'].width() - this.options.scrollbarWidth, this.options['height']);
            }
            if (this.options['heightMode'] === 'full') {
                this.$els['content-wrapper'].bind('scroll', _.debounce(_.bind(this.wrapperScroll, this), 40));
                if (this.options.autoResize) {
                    $(window).bind('resize', _.debounce(function () {
                        self.trigger('resize');
                    }, 40));
                }
                this.trigger('resize');
            }
            return this;
        },
        /**
         * Создаём ColGroup исходя из колонок (+ добавляем колонку если используется выделение элементов)
         * 1. Если есть style у колонки то добавляем стиль [colSize + style] ~ "b-backtable__col_size_" + "checkbox"
         * 2. В ином случае используем размер по умолчанию
         *
         * @private
         * @returns {*|jQuery|HTMLElement}
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
         * Добавление строки
         *
         * @param model
         * @private
         * @returns {BackTable}
         */
        _add: function (model) {
            var current =  this.list.push(new this.options.row({
                className: this.getCss('tr'),
                parent: this,
                model: model
            })) - 1;
            this.$els['content'].append(this.list[current].render().el);
            return this;
        },
        /**
         * Добавление строк
         *
         * @private
         * @param {BackTableCollection} models Список новых строк
         * @returns {BackTable}
         */
        _reset: function (models, options) {
            _.each(this.list, function (view) {
                view.remove();
            }, this);
            this.list = [];
            models.each(function (model) {
                this._add(model);
            }, this);
            this.trigger('reset');
            return this;
        },
        /**
         * Событие сортировки
         *
         * @param models
         * @returns {BackTable}
         * @private
         */
        _sort: function (models) {
            // console.log('>>> sort', models, arguments);
            return this;
        },
        /**
         * Запустить сортировку коллекции
         *
         * @param {string} sortKeys Ключ сортировки
         * @param {integer} order Направление сортировки: -1 Asc, 1 Desc
         * @param {string} sortType Тип сортировки: string || integer
         * @returns {BackTable}
         */
        sort: function (sortKey, order, sortType) {
            var self = this;
            this.collection.setSorting(sortKey, order);
            this.collection.state.sortType = sortType || 'string';
            // Full (Client mode + infinite)
            if (this.collection.fullCollection) {
                this.collection.fullCollection.sort();
                this.collection.trigger("sorted", sortKey, order, this.collection);
                // Server
            } else {
                this.collection.fetch({reset: true, success: function () {
                    self.collection.trigger("sorted", sortKey, order, self.collection);
                }});
            }
            return this;
        },
        /**
         * Событие удаления строки
         *
         * @param model
         * @returns {BackTable}
         * @private
         */
        _remove: function (model) {
            // console.log('>>> remove', model);
            return this;
        },
        /**
         * Действия после прокрутки контейнера
         *
         * @returns {BackTable}
         */
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
            return this;
        },
        /**
         * Действия при изменении размера окна
         *
         * @returns {BackTable}
         */
        resizeWindow: function () {
            var height = $(window).height() - this.$els['content-wrapper'].offset().top - this.$els['content-wrapper'].css("padding-top").replace("px", "") - this.options['heightAdditional'],
                width = this.$els['content-wrapper'].width() - this.options.scrollbarWidth;
            this.resize(width, height)
                .wrapperScroll();
            return this;
        },
        /**
         * Изменить размеры загаловка и основной таблицы
         *
         * @param {number} width Ширина
         * @param {number} height Высота
         * @returns {BackTable}
         */
        resize: function (width, height) {
            this.$els['header'].css('width', width);
            this.$els['content']
                .css('margin-top', this.$els['header'].height())
                .css('width', width);
            this.$els['content-wrapper'].height(height);
            return this;
        },
        /**
         * Получить ширину скроллбара
         *
         * @private
         * @returns {number}
         */
        _getScrollbarWidth: function () {
            var $outer = $(document.createElement('div')).width('100px').height('100px').css('overflow', 'scroll').appendTo($('body')),
                $temporary = $(document.createElement('p')).css('width', '100%').css('height', '100%').appendTo($outer),
                width = 100 - $temporary.width();
            $outer.remove();
            return width;
        }
    });

    /**
     * @constructor
     */
    var BackTableModel = Backbone.Model.extend({
        checked: false,
        /**
         * Перевести режим выборки модели
         *
         * @param {boolean} bool [True выброано, False нет]
         * @param {boolean} silent Промолчать об изменении выборки?
         * @fires checkedItem
         */
        checkedSet: function (bool, silent) {
            if (bool !== this.checked) {
                this.checked = bool;
                if (!silent) {
                    this.trigger('checkedItem');
                }
            }
        }
    });
    /**
     * @constructor
     */
    var BackTableCollection = Backbone.PageableCollection.extend({
        checkedCount: 0,
        /**
         * Переключение всех моделей в режим выбрано/не выбрано
         *
         * @param {boolean} bool [True выброано, False нет]
         * @param {boolean} silent Промолчать об изменении выборки?
         * @fires checked
         */
        checkedToggle: function (bool, silent) {
            this.each(function (item) {
                item.checkedSet(bool);
            }, this);
            this.checkedCount = (bool) ? this.length : 0;
            if (!silent) {
                this.trigger('checked', this.checkedCount);
            }
        },
        checkedMany: function (id) {
            var minID = this.lastChecked > id ? id : this.lastChecked,
                maxID = this.lastChecked < id ? id : this.lastChecked;
            this.each(function (item) {
                if (item.id >= minID && item.id <= maxID) {
                    item.checkedSet(true, false);
                }
            })
        },
        /**
         * Подсчёт выбранных элементов
         *
         * @param {boolean} bool  [True выброано, False нет]
         * @param {boolean} silent Промолчать об изменении?
         * @fires checked
         */
        checkedSet: function (bool, silent) {
            (bool) ? this.checkedCount++ : this.checkedCount--;
            if (!silent) {
                this.trigger('checked', this.checkedCount);
            }
        },
        /**
         * Получить все выюранные модели
         *
         * @returns {BackTableModel[]}
         */
        getChecked: function () {
            return this.filter(function (model) {
                return model.checked;
            });
        },
        /**
         * Переопределение функции сравнения моделей в коллекции
         *
         * @param {string} sortKey Ключ сортировки
         * @param {integer} order Направление
         * @param {string} sortValue Значение
         * @returns {Function}
         * @private
         */
        _makeComparator: function (sortKey, order, sortValue) {
            return function (a, b) {
                var state = this.pageableCollection ? this.pageableCollection.state : this.state;
                if (!state) {
                    console.error("Can't find state in collection. Maybe u don't use Backbone pageable?");
                    return 0;
                }
                var type = state.sortType || 'string',
                    va = a.get(state.sortKey),
                    vb = b.get(state.sortKey);
                if (type === 'string') {
                    va = (_.isEmpty(va)) ? "" : String(va);
                    vb = (_.isEmpty(vb)) ? "" : String(vb);
                }
                return this.pageableCollection.state.order === -1 ? (va > vb ? 1 : (va === vb ? 0 : -1)) : (va > vb ? -1 : (va === vb ? 0 : 1));

            }
        }
    });
    return {
        BackTable: BackTable,
        BackTableRow: BackTableRow,
        BackTableCollection: BackTableCollection,
        BackTableModel: BackTableModel
    }
}));