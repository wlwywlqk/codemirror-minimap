(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('codemirror'), require('lodash')) :
    typeof define === 'function' && define.amd ? define(['exports', 'codemirror', 'lodash'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.CodemirrorMinimap = {}, global.CodeMirror, global.lodash));
}(this, (function (exports, CodeMirror, lodash) { 'use strict';

    CodeMirror = CodeMirror && Object.prototype.hasOwnProperty.call(CodeMirror, 'default') ? CodeMirror['default'] : CodeMirror;
    lodash = lodash && Object.prototype.hasOwnProperty.call(lodash, 'default') ? lodash['default'] : lodash;

    (function (Constants) {
        Constants[Constants["DEFAULT_SCALE"] = 5] = "DEFAULT_SCALE";
    })(exports.Constants || (exports.Constants = {}));
    var Slider = /** @class */ (function () {
        function Slider(cm, instance) {
            var _this = this;
            this.$slider = document.createElement('div');
            this.translateY = 0;
            this.isMoving = false;
            this.startY = 0;
            this.startScrollTop = 0;
            this.onMousedown = function (e) {
                _this.isMoving = true;
                _this.startY = e.clientY;
                _this.startScrollTop = _this.instance.$scrollContainer.scrollTop;
                document.addEventListener('mousemove', _this.onMousemove);
                document.addEventListener('mouseup', _this.onMouseup);
                document.onselectstart = function () { return false; };
            };
            this.onMouseup = function () {
                document.removeEventListener('mousemove', _this.onMousemove);
                document.removeEventListener('mouseup', _this.onMouseup);
            };
            this.onMousemove = function (e) {
                if (!_this.isMoving)
                    return;
                var distance = e.clientY - _this.startY;
                var _a = _this.instance, renderData = _a.renderData, $scrollContainer = _a.$scrollContainer;
                var scrollTop = _this.startScrollTop
                    + distance
                        / (renderData.height - renderData.sliderHeight)
                        * ($scrollContainer.scrollHeight - $scrollContainer.clientHeight);
                _this.instance.$scrollContainer.scrollTo(0, scrollTop);
            };
            this.render = function () {
                var _a = _this.instance.renderData, translateY = _a.translateY, sliderHeight = _a.sliderHeight;
                _this.$slider.style.height = sliderHeight + "px";
                _this.$slider.style.transform = "translateY(" + translateY + "px)";
            };
            this.cm = cm;
            this.instance = instance;
            this.$slider.setAttribute('class', 'CodeMirror-minimap__slider');
            this.$slider.addEventListener('mousedown', this.onMousedown);
            this.instance.$root.appendChild(this.$slider);
        }
        Slider.prototype.destroy = function () {
            if (this.$slider.parentNode) {
                this.$slider.parentNode.removeChild(this.$slider);
            }
        };
        return Slider;
    }());
    var RenderData = /** @class */ (function () {
        function RenderData(cm, instance) {
            this.data = [];
            this.yAxisMap = [];
            this.height = 0;
            this.sliderHeight = 0;
            this.translateY = 0;
            this.cm = cm;
            this.instance = instance;
        }
        RenderData.prototype.calcTranslateY = function () {
            var _a = this.instance.$scrollContainer, scrollTop = _a.scrollTop, sh = _a.scrollHeight, ch = _a.clientHeight;
            var clientHeight = this.instance.$container.clientHeight;
            var _b = this, height = _b.height, sliderHeight = _b.sliderHeight;
            var scrollHeight = sh - ch + clientHeight;
            if (scrollHeight === clientHeight) {
                this.translateY = 0;
                return;
            }
            if (height < this.instance.$canvas.height) {
                var viewportStartLine = this.instance.viewportStartLine;
                var intViewportStartLine = Math.floor(viewportStartLine);
                var y = 0;
                for (var i = 0; i < intViewportStartLine; i++) {
                    y += this.getLineData(i).lineHeight;
                }
                var currentLineData = this.getLineData(intViewportStartLine);
                this.translateY = y + (viewportStartLine - intViewportStartLine) * currentLineData.lineHeight;
                return;
            }
            var scrollTopPercent = scrollTop / (scrollHeight - clientHeight);
            this.translateY = (height - sliderHeight) * scrollTopPercent;
        };
        RenderData.prototype.calcHeight = function () {
            var maxHeight = this.instance.$canvas.height;
            var lineCount = this.cm.doc.lineCount();
            var i = 0;
            var y = 0;
            while (i <= lineCount - 1 && y < maxHeight) {
                var lineData = this.getLineData(i);
                y += lineData.lineHeight;
                i++;
            }
            this.height = Math.min(y, maxHeight);
        };
        RenderData.prototype.calcSliderHeight = function () {
            var viewportStartLine = this.instance.viewportStartLine;
            var intViewportStartLine = Math.floor(viewportStartLine);
            var viewportEndLine = this.instance.viewportEndLine;
            var intViewportEndLine = Math.floor(viewportEndLine);
            var lineData = this.getLineData(intViewportStartLine);
            var sliderHeight = (1 - (viewportStartLine - intViewportStartLine)) * lineData.lineHeight;
            for (var i = intViewportStartLine + 1; i < intViewportEndLine; i++) {
                lineData = this.getLineData(i);
                sliderHeight += lineData.lineHeight;
            }
            lineData = this.getLineData(intViewportEndLine);
            sliderHeight += (viewportEndLine - intViewportEndLine) * lineData.lineHeight;
            this.sliderHeight = sliderHeight;
        };
        RenderData.prototype.refresh = function () {
            this.calcTranslateY();
            this.data = [];
            this.yAxisMap = [];
            var maxHeight = this.instance.$canvas.height;
            var lineCount = this.cm.doc.lineCount();
            var viewportStartLine = this.instance.viewportStartLine;
            var intViewportStartLine = Math.floor(viewportStartLine);
            var lineData = this.getLineData(intViewportStartLine);
            var startY = this.translateY - (viewportStartLine - intViewportStartLine) * lineData.lineHeight;
            this.data.push(lineData);
            this.yAxisMap.push(startY);
            var y = startY;
            var line = intViewportStartLine - 1;
            while (y >= 0 && line >= 0) {
                var ld = this.getLineData(line);
                this.data.unshift(ld);
                y -= ld.lineHeight;
                this.yAxisMap.unshift(y);
                line--;
            }
            y = startY + lineData.lineHeight;
            line = intViewportStartLine + 1;
            while (y <= maxHeight && line < lineCount) {
                var ld = this.getLineData(line);
                this.data.push(ld);
                this.yAxisMap.push(y);
                y += ld.lineHeight;
                line++;
            }
            this.yAxisMap.push(y);
        };
        RenderData.prototype.checkFolded = function (lineHandle) {
            if (lineHandle.markedSpans) {
                return lineHandle.markedSpans.some(function (_a) {
                    var marker = _a.marker;
                    return marker.__isFold && marker.lines.indexOf(lineHandle) > 0;
                });
            }
            return false;
        };
        RenderData.prototype.getLineData = function (lineNum) {
            var tokenData = [];
            var lineHeight = this.instance.baseLineHeight;
            var handle = this.cm.getLineHandle(lineNum);
            var tokens = this.cm.getLineTokens(lineNum);
            if (!handle || this.checkFolded(handle)) {
                return {
                    lineHeight: 0,
                    tokenData: tokenData,
                    line: lineNum,
                    handle: handle,
                };
            }
            for (var i = 0, len = tokens.length; i < len; i++) {
                var token = tokens[i];
                var fontInfo = this.instance.getFontInfoFromTokenType(token.type);
                lineHeight = Math.max(fontInfo.fontSize, lineHeight);
                tokenData.push({
                    fontInfo: fontInfo,
                    text: token.string
                });
            }
            return {
                lineHeight: lineHeight,
                tokenData: tokenData,
                line: lineNum,
                handle: handle,
            };
        };
        RenderData.prototype.dispatchChange = function () {
            this.calcHeight();
            this.calcSliderHeight();
        };
        RenderData.prototype.dispatchViewportChange = function () {
            this.calcSliderHeight();
        };
        return RenderData;
    }());
    var InnerMinimap = /** @class */ (function () {
        function InnerMinimap(cm, scale) {
            var _this = this;
            this.$root = document.createElement('div');
            this.$canvas = document.createElement('canvas');
            this.fontInfoMap = new Map();
            this.render = lodash.throttle(function () {
                _this.renderData.refresh();
                setTimeout(function () {
                    var _a = _this.$canvas, width = _a.width, height = _a.height;
                    var ctx = _this.$canvas.getContext('2d');
                    ctx.clearRect(0, 0, width, height);
                    for (var i = 0, len = _this.renderData.data.length; i < len; i++) {
                        _this.renderLine(i);
                    }
                    _this.slider.render();
                });
            }, 1000 / 60);
            this.cm = cm;
            this.$container = this.cm.getWrapperElement();
            this.$root.setAttribute('class', 'CodeMirror-minimap');
            this.$canvas.setAttribute('class', 'CodeMirror-minimap__canvas');
            this.$root.appendChild(this.$canvas);
            this.$container.appendChild(this.$root);
            this.$scrollContainer = this.cm.getScrollerElement();
            this.scale = scale;
            var fontSize = this.getFontInfoFromTokenType(null).fontSize;
            this.baseLineHeight = fontSize;
            this.slider = new Slider(this.cm, this);
            this.renderData = new RenderData(this.cm, this);
        }
        Object.defineProperty(InnerMinimap.prototype, "viewportStartLine", {
            get: function () {
                var offset = this.$container.getBoundingClientRect().top;
                var line = this.cm.lineAtHeight(offset);
                var lineHandle = this.cm.getLineHandle(line);
                if (!lineHandle) {
                    return line;
                }
                var decimal = Math.max((offset - this.cm.heightAtLine(line)) / lineHandle.height, 0);
                return line + decimal;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(InnerMinimap.prototype, "viewportEndLine", {
            get: function () {
                var offset = this.$container.getBoundingClientRect().bottom;
                var line = this.cm.lineAtHeight(offset);
                var lineHandle = this.cm.getLineHandle(line);
                if (!lineHandle) {
                    return line;
                }
                var decimal = Math.max((offset - this.cm.heightAtLine(line)) / lineHandle.height, 0);
                return line + decimal;
            },
            enumerable: false,
            configurable: true
        });
        InnerMinimap.prototype.destroy = function () {
            if (this.$canvas.parentNode) {
                this.$canvas.parentNode.removeChild(this.$canvas);
            }
        };
        InnerMinimap.prototype.renderLine = function (line) {
            var ctx = this.$canvas.getContext('2d');
            ctx.textBaseline = 'bottom';
            var _a = this.renderData.data[line], lineHeight = _a.lineHeight, tokenData = _a.tokenData;
            var y = this.renderData.yAxisMap[line];
            if (lineHeight <= 0) {
                return 0;
            }
            if (tokenData.length === 0) {
                return this.baseLineHeight;
            }
            var x = 0;
            for (var i = 0, len = tokenData.length; i < len; i++) {
                var _b = tokenData[i], _c = _b.fontInfo, font = _c.font, color = _c.color, text = _b.text;
                ctx.font = font;
                ctx.fillStyle = color;
                ctx.fillText(text, x, y + lineHeight);
                x += ctx.measureText(text).width;
            }
        };
        InnerMinimap.prototype.getFontInfoFromTokenType = function (type) {
            if (type === void 0) { type = null; }
            if (this.fontInfoMap.has(type)) {
                return this.fontInfoMap.get(type);
            }
            var $el = document.createElement('span');
            if (type) {
                $el.setAttribute('class', type.replace(/([^\s]+)/g, 'cm-$1'));
            }
            this.$container.appendChild($el);
            var style = window.getComputedStyle($el);
            var fontSize = Math.floor(parseFloat(style.fontSize) / this.scale);
            var result = {
                font: style.fontStyle + " " + style.fontWeight + " " + fontSize + "px " + style.fontFamily,
                fontSize: fontSize,
                color: style.color
            };
            this.fontInfoMap.set(type, result);
            this.$container.removeChild($el);
            return result;
        };
        InnerMinimap.prototype.renderOnResize = function (width, height) {
            this.$canvas.width = width;
            this.$canvas.height = height;
            this.$canvas.style.width = this.$canvas.width + "px";
            this.$canvas.style.height = this.$canvas.height + "px";
            // this.cm.display.sizer.style.marginRight = this.$canvas.style.width;
            this.renderOnChange();
        };
        InnerMinimap.prototype.renderOnViewportChange = function () {
            this.renderData.dispatchViewportChange();
            this.render();
        };
        InnerMinimap.prototype.renderOnChange = function () {
            this.renderData.dispatchChange();
            this.render();
        };
        return InnerMinimap;
    }());
    var CodeMirrorMinimap = /** @class */ (function () {
        function CodeMirrorMinimap(cm, options) {
            var _this = this;
            this.onResize = lodash.throttle(function () {
                var _a = _this.$container.getBoundingClientRect(), width = _a.width, height = _a.height;
                _this.instance.renderOnResize(width / _this.scale, height);
            }, 50);
            this.onCMScroll = lodash.throttle(function (cm) {
                _this.instance.renderOnViewportChange();
            }, 50);
            this.onCMUpdate = function () {
                _this.instance.renderOnChange();
            };
            var _a = (options || {}).scale, scale = _a === void 0 ? exports.Constants.DEFAULT_SCALE : _a;
            this.cm = cm;
            this.scale = Math.max(2, Math.min(10, scale));
            this.$container = this.cm.getWrapperElement();
            this.instance = new InnerMinimap(this.cm, this.scale);
            this.onResize();
            window.addEventListener('resize', this.onResize);
            this.cm.on('scroll', this.onCMScroll);
            this.cm.on('update', this.onCMUpdate);
        }
        CodeMirrorMinimap.prototype.destroy = function () {
            window.removeEventListener('resize', this.onResize);
            this.cm.off('scroll', this.onCMScroll);
            this.cm.off('update', this.onCMUpdate);
        };
        return CodeMirrorMinimap;
    }());
    CodeMirror.defineOption('minimap', false, function (cm, display, old) {
        if (old && old !== CodeMirror.Init) {
            if (cm.state.minimap) {
                cm.state.minimap.destroy();
                cm.state.minimap = null;
            }
        }
        if (display) {
            cm.state.minimap = new CodeMirrorMinimap(cm, typeof display === 'object' ? display : {});
        }
    });

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
