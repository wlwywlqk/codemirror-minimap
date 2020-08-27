import CodeMirror from 'codemirror';
import lodash from 'lodash';

export enum Constants {
    DEFAULT_SCALE = 5,
}

export interface Options {
    scale: number;
}

export interface FontInfo {
    font: string;
    fontSize: number;
    color: string;
};

export type RenderTokenData = {
    fontInfo: FontInfo,
    text: string
}

export interface RenderLineData {
    lineHeight: number;
    tokenData: RenderTokenData[];
    line: number;
    handle: any;
}

class Slider {
    public readonly cm: any;
    public readonly instance: InnerMinimap;
    public readonly $slider: HTMLDivElement = document.createElement('div');

    public translateY: number = 0;

    private isMoving = false;
    private startY = 0;
    private startScrollTop = 0;

    constructor(cm: any, instance: InnerMinimap) {
        this.cm = cm;
        this.instance = instance;

        this.$slider.setAttribute('class', 'CodeMirror-minimap__slider');
        this.$slider.addEventListener('mousedown', this.onMousedown);

        this.instance.$root.appendChild(this.$slider);
    }

    private onMousedown = (e: MouseEvent) => {
        this.isMoving = true;
        this.startY = e.clientY;
        this.startScrollTop = this.instance.$scrollContainer.scrollTop;
        document.addEventListener('mousemove', this.onMousemove);
        document.addEventListener('mouseup', this.onMouseup);
        document.onselectstart = () => false;
    }

    private onMouseup = () => {
        document.removeEventListener('mousemove', this.onMousemove);
        document.removeEventListener('mouseup', this.onMouseup);
        document.onselectstart = null;
    }

    private onMousemove = (e: MouseEvent) => {
        if (!this.isMoving) return;
        const distance = e.clientY - this.startY;
        const { renderData, $scrollContainer } = this.instance;
        const scrollTop = this.startScrollTop
            + distance
            / (renderData.height - renderData.sliderHeight)
            * ($scrollContainer.scrollHeight - $scrollContainer.clientHeight);

        this.instance.$scrollContainer.scrollTo(0, scrollTop);
    }


    public render = () => {
        const { renderData: { translateY, sliderHeight } } = this.instance;

        this.$slider.style.height = `${sliderHeight}px`;
        this.$slider.style.transform = `translateY(${translateY}px)`;
    }

    public destroy() {
        this.$slider.removeEventListener('mousedown', this.onMousedown);
        if (this.$slider.parentNode) {
            this.$slider.parentNode.removeChild(this.$slider);
        }

    }
}

class RenderData {
    public readonly cm: any;
    public readonly instance: InnerMinimap;

    public data: RenderLineData[] = [];
    public yAxisMap: number[] = [];

    public height: number = 0;
    public sliderHeight: number = 0;
    public translateY: number = 0;

    constructor(cm: any, instance: InnerMinimap) {
        this.cm = cm;
        this.instance = instance;
    }

    private calcTranslateY() {
        const { scrollTop, scrollHeight: sh, clientHeight: ch } = this.instance.$scrollContainer;
        const { clientHeight } = this.instance.$container;
        const { height, sliderHeight } = this;

        const scrollHeight = sh - ch + clientHeight;
        if (scrollHeight === clientHeight) {
            this.translateY = 0;
            return;
        }

        if (height < this.instance.$canvas.height) {
            const viewportStartLine = this.instance.viewportStartLine;
            const intViewportStartLine = Math.floor(viewportStartLine);

            let y = 0;
            for (let i = 0; i < intViewportStartLine; i++) {
                y += this.getLineData(i).lineHeight;
            }
            const currentLineData = this.getLineData(intViewportStartLine);

            this.translateY = y + (viewportStartLine - intViewportStartLine) * currentLineData.lineHeight;
            return;
        }

        const scrollTopPercent = scrollTop / (scrollHeight - clientHeight);
        this.translateY = (height - sliderHeight) * scrollTopPercent;
    }

    private calcHeight() {
        const maxHeight = this.instance.$canvas.height;
        const lineCount = this.cm.doc.lineCount();
        let i = 0;
        let y = 0;

        while (i <= lineCount - 1 && y < maxHeight) {
            const lineData = this.getLineData(i);
            y += lineData.lineHeight;
            i++;
        }
        this.height = Math.min(y, maxHeight);
    }

    private calcSliderHeight() {
        const viewportStartLine = this.instance.viewportStartLine;
        const intViewportStartLine = Math.floor(viewportStartLine);

        const viewportEndLine = this.instance.viewportEndLine;
        const intViewportEndLine = Math.floor(viewportEndLine);

        let lineData: RenderLineData = this.getLineData(intViewportStartLine);
        let sliderHeight = (1 - (viewportStartLine - intViewportStartLine)) * lineData.lineHeight;
        for (let i = intViewportStartLine + 1; i < intViewportEndLine; i++) {
            lineData = this.getLineData(i);
            sliderHeight += lineData.lineHeight;
        }
        lineData = this.getLineData(intViewportEndLine);
        sliderHeight += (viewportEndLine - intViewportEndLine) * lineData.lineHeight;

        this.sliderHeight = sliderHeight;
    }

    public refresh() {
        this.calcTranslateY();

        this.data = [];
        this.yAxisMap = [];

        const maxHeight = this.instance.$canvas.height;
        const lineCount = this.cm.doc.lineCount();

        const viewportStartLine = this.instance.viewportStartLine;
        const intViewportStartLine = Math.floor(viewportStartLine);

        const lineData: RenderLineData = this.getLineData(intViewportStartLine);

        const startY = this.translateY - (viewportStartLine - intViewportStartLine) * lineData.lineHeight;
        this.data.push(lineData);
        this.yAxisMap.push(startY);

        let y = startY;
        let line = intViewportStartLine - 1;
        while (y >= 0 && line >= 0) {
            const ld = this.getLineData(line);
            this.data.unshift(ld);
            y -= ld.lineHeight;
            this.yAxisMap.unshift(y);
            line--;
        }

        y = startY + lineData.lineHeight;
        line = intViewportStartLine + 1;
        while (y <= maxHeight && line < lineCount) {
            const ld = this.getLineData(line);

            this.data.push(ld);
            this.yAxisMap.push(y);
            y += ld.lineHeight;
            line++;
        }

        this.yAxisMap.push(y);
    }

    private checkFolded(lineHandle: any): boolean {
        if (lineHandle.markedSpans) {
            return lineHandle.markedSpans.some(({ marker }) => {
                return marker.__isFold && marker.lines.indexOf(lineHandle) > 0;
            })
        }
        return false;
    }

    private getLineData(lineNum: number): RenderLineData {
        const tokenData: RenderTokenData[] = [];
        let lineHeight = this.instance.baseLineHeight;

        const handle = this.cm.getLineHandle(lineNum);
        const tokens = this.cm.getLineTokens(lineNum);

        if (!handle || this.checkFolded(handle)) {
            return {
                lineHeight: 0,
                tokenData,
                line: lineNum,
                handle,
            };
        }

        for (let i = 0, len = tokens.length; i < len; i++) {
            const token = tokens[i];
            const fontInfo = this.instance.getFontInfoFromTokenType(token.type);
            lineHeight = Math.max(fontInfo.fontSize, lineHeight);
            tokenData.push({
                fontInfo,
                text: token.string
            });
        }

        return {
            lineHeight,
            tokenData,
            line: lineNum,
            handle,
        };
    }

    public dispatchChange() {
        this.calcHeight();
        this.calcSliderHeight();
    }

    public dispatchViewportChange() {
        this.calcSliderHeight();
    }
}

class InnerMinimap {
    public readonly cm: any;

    public readonly $root: HTMLDivElement = document.createElement('div');
    public readonly $canvas: HTMLCanvasElement = document.createElement('canvas');
    public readonly $container: HTMLElement;
    public readonly $scrollContainer: HTMLElement;
    public readonly scale: number;

    public readonly baseLineHeight: number;

    public readonly renderData: RenderData;
    public readonly slider: Slider;

    private fontInfoMap: Map<string, FontInfo> = new Map();

    constructor(cm: any, scale: number) {
        this.cm = cm;
        this.$container = this.cm.getWrapperElement();

        this.$root.setAttribute('class', 'CodeMirror-minimap');
        this.$canvas.setAttribute('class', 'CodeMirror-minimap__canvas');
        this.$root.appendChild(this.$canvas);
        this.$container.appendChild(this.$root);

        this.$scrollContainer = this.cm.getScrollerElement();
        this.scale = scale;

        const { fontSize } = this.getFontInfoFromTokenType(null);
        this.baseLineHeight = fontSize;

        this.slider = new Slider(this.cm, this);
        this.renderData = new RenderData(this.cm, this);
    }

    public get viewportStartLine() {
        const offset = this.$container.getBoundingClientRect().top;
        const line = this.cm.lineAtHeight(offset);
        const lineHandle = this.cm.getLineHandle(line);
        if (!lineHandle) {
            return line;
        }
        const decimal = Math.max((offset - this.cm.heightAtLine(line)) / lineHandle.height, 0);
        return line + decimal;
    }

    public get viewportEndLine() {
        const offset = this.$container.getBoundingClientRect().bottom;
        const line = this.cm.lineAtHeight(offset);
        const lineHandle = this.cm.getLineHandle(line);
        if (!lineHandle) {
            return line;
        }
        const decimal = Math.max((offset - this.cm.heightAtLine(line)) / lineHandle.height, 0);
        return line + decimal;
    }

    public destroy() {
        this.slider.destroy();
        if (this.$canvas.parentNode) {
            this.$canvas.parentNode.removeChild(this.$canvas);
        }
        if (this.$root.parentNode) {
            this.$root.parentNode.removeChild(this.$root);
        }
    }

    private renderLine(line: number): number {
        const ctx = this.$canvas.getContext('2d');
        ctx.textBaseline = 'bottom';

        const { lineHeight, tokenData } = this.renderData.data[line];
        const y = this.renderData.yAxisMap[line];
        if (lineHeight <= 0) {
            return 0;
        }

        if (tokenData.length === 0) {
            return this.baseLineHeight;
        }
        let x = 0;
        for (let i = 0, len = tokenData.length; i < len; i++) {
            const { fontInfo: { font, color }, text } = tokenData[i];
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y + lineHeight);
            x += ctx.measureText(text).width;
            if (x > this.$canvas.width) {
                break;
            }
        }
    }

    private render = lodash.throttle(() => {
        this.renderData.refresh();
        setTimeout(() => {
            const { width, height } = this.$canvas;
            const ctx = this.$canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            for (let i = 0, len = this.renderData.data.length; i < len; i++) {
                this.renderLine(i);
            }
    
            this.slider.render();
        })
    }, 1000 / 60)


    public getFontInfoFromTokenType(type: string = null): FontInfo {
        if (this.fontInfoMap.has(type)) {
            return this.fontInfoMap.get(type);
        }
        const $el = document.createElement('span');
        if (type) {
            $el.setAttribute('class', type.replace(/([^\s]+)/g, 'cm-$1'));
        }
        this.$container.appendChild($el);
        const style = window.getComputedStyle($el);

        const fontSize = Math.floor(parseFloat(style.fontSize) / this.scale);
        const result: FontInfo = {
            font: `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`,
            fontSize,
            color: style.color
        };

        this.fontInfoMap.set(type, result);

        this.$container.removeChild($el);
        return result;
    }

    public renderOnResize(width: number, height: number) {
        this.$canvas.width = width;
        this.$canvas.height = height;
        this.$canvas.style.width = `${this.$canvas.width}px`;
        this.$canvas.style.height = `${this.$canvas.height}px`;
        // this.cm.display.sizer.style.marginRight = this.$canvas.style.width;

        this.renderOnChange();
    }

    public renderOnViewportChange() {
        this.renderData.dispatchViewportChange();
        this.render();
    }

    public renderOnChange() {
        this.renderData.dispatchChange();
        this.render();
    }
}



class CodeMirrorMinimap {
    public readonly cm: any;
    public readonly $container: HTMLElement;
    public readonly instance: InnerMinimap;
    public readonly scale: number;


    constructor(cm: any, options?: Options) {
        const { scale = Constants.DEFAULT_SCALE } = options || {};
        this.cm = cm;
        this.scale = Math.max(2, Math.min(10, scale));

        this.$container = this.cm.getWrapperElement();
        this.instance = new InnerMinimap(this.cm, this.scale);

        this.onResize();

        window.addEventListener('resize', this.onResize);
        this.cm.on('scroll', this.onCMScroll);
        this.cm.on('update', this.onCMUpdate);
    }


    public destroy() {
        window.removeEventListener('resize', this.onResize);
        this.cm.off('scroll', this.onCMScroll);
        this.cm.off('update', this.onCMUpdate);
        this.instance.destroy();
    }

    private onResize = lodash.throttle(() => {
        const { width, height } = this.$container.getBoundingClientRect();
        this.instance.renderOnResize(width / this.scale, height);
    }, 50)

    private onCMScroll = lodash.throttle((cm: any) => {
        this.instance.renderOnViewportChange();
    }, 50)

    private onCMUpdate = () => {
        this.instance.renderOnChange();
    }

}


(CodeMirror as any).defineOption('minimap', false, function (cm, display, old) {
    if (old && old !== (CodeMirror as any).Init) {
        if (cm.state.minimap) {
            cm.state.minimap.destroy();
            cm.state.minimap = null;
        }
    }

    if (display) {
        cm.state.minimap = new CodeMirrorMinimap(cm, typeof display === 'object' ? display : {});
    }
});
