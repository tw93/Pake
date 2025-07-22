import { Component } from 'vue';
import { ComponentOptionsMixin } from 'vue';
import { ComputedRef } from 'vue';
import * as defaultCompiler from 'vue/compiler-sfc';
import { DefineComponent } from 'vue';
import { editor } from 'monaco-editor-core';
import { ExtractPropTypes } from 'vue';
import { PropType } from 'vue';
import { PublicProps } from 'vue';
import { Ref } from 'vue';
import { SFCAsyncStyleCompileOptions } from 'vue/compiler-sfc';
import { SFCScriptCompileOptions } from 'vue/compiler-sfc';
import { SFCTemplateCompileOptions } from 'vue/compiler-sfc';
import { ToRefs } from 'vue';
import { UnwrapRef } from 'vue';

declare type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;

declare type __VLS_NonUndefinedable_2<T> = T extends undefined ? never : T;

declare type __VLS_Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

declare type __VLS_TypePropsToRuntimeProps<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? {
        type: PropType<__VLS_NonUndefinedable<T[K]>>;
    } : {
        type: PropType<T[K]>;
        required: true;
    };
};

declare type __VLS_TypePropsToRuntimeProps_2<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? {
        type: PropType<__VLS_NonUndefinedable_2<T[K]>>;
    } : {
        type: PropType<T[K]>;
        required: true;
    };
};

declare type __VLS_WithDefaults<P, D> = {
    [K in keyof Pick<P, keyof P>]: K extends keyof D ? __VLS_Prettify<P[K] & {
        default: D[K];
    }> : P[K];
};

export declare function compileFile(store: Store, { filename, code, compiled }: File_2): Promise<(string | Error)[]>;

declare type EditorComponentType = Component<EditorProps>;

declare type EditorMode = 'js' | 'css' | 'ssr';

declare interface EditorProps {
    value: string;
    filename: string;
    readonly?: boolean;
    mode?: EditorMode;
}

declare class File_2 {
    filename: string;
    code: string;
    hidden: boolean;
    compiled: {
        js: string;
        css: string;
        ssr: string;
    };
    editorViewState: editor.ICodeEditorViewState | null;
    constructor(filename: string, code?: string, hidden?: boolean);
    get language(): "typescript" | "html" | "css" | "vue" | "javascript";
}
export { File_2 as File }

export declare interface ImportMap {
    imports?: Record<string, string | undefined>;
    scopes?: Record<string, Record<string, string>>;
}

export declare function mergeImportMap(a: ImportMap, b: ImportMap): ImportMap;

export declare type OutputModes = 'preview' | EditorMode;

export declare const Preview: DefineComponent<__VLS_TypePropsToRuntimeProps_2<{
show: boolean;
ssr: boolean;
}>, {
reload: typeof reload_2;
container: Ref<any>;
}, unknown, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<ExtractPropTypes<__VLS_TypePropsToRuntimeProps_2<{
show: boolean;
ssr: boolean;
}>>>, {}, {}>;

/**
 * Reload the preview iframe
 */
declare function reload(): void;

/**
 * Reload the preview iframe
 */
declare function reload_2(): void;

export declare const Repl: DefineComponent<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<ReplProps>, {
theme: string;
previewTheme: boolean;
store: () => ReplStore;
autoResize: boolean;
autoSave: boolean;
showCompileOutput: boolean;
showImportMap: boolean;
showTsConfig: boolean;
clearConsole: boolean;
layoutReverse: boolean;
ssr: boolean;
previewOptions: () => {
headHTML: string;
bodyHTML: string;
placeholderHTML: string;
customCode: {
importCode: string;
useCode: string;
};
};
layout: string;
}>, {
reload: typeof reload;
}, unknown, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<ExtractPropTypes<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<ReplProps>, {
theme: string;
previewTheme: boolean;
store: () => ReplStore;
autoResize: boolean;
autoSave: boolean;
showCompileOutput: boolean;
showImportMap: boolean;
showTsConfig: boolean;
clearConsole: boolean;
layoutReverse: boolean;
ssr: boolean;
previewOptions: () => {
headHTML: string;
bodyHTML: string;
placeholderHTML: string;
customCode: {
importCode: string;
useCode: string;
};
};
layout: string;
}>>>, {
ssr: boolean;
store: Store;
theme: "dark" | "light";
layout: "horizontal" | "vertical";
previewOptions: {
headHTML?: string;
bodyHTML?: string;
placeholderHTML?: string;
customCode?: {
importCode?: string;
useCode?: string;
};
};
previewTheme: boolean;
showCompileOutput: boolean;
showTsConfig: boolean;
showImportMap: boolean;
autoResize: boolean;
autoSave: boolean;
clearConsole: boolean;
layoutReverse: boolean;
}, {}>;

export declare interface ReplProps {
    theme?: 'dark' | 'light';
    previewTheme?: boolean;
    editor: EditorComponentType;
    store?: Store;
    autoResize?: boolean;
    autoSave?: boolean;
    showCompileOutput?: boolean;
    showImportMap?: boolean;
    showTsConfig?: boolean;
    clearConsole?: boolean;
    layout?: 'horizontal' | 'vertical';
    layoutReverse?: boolean;
    ssr?: boolean;
    previewOptions?: {
        headHTML?: string;
        bodyHTML?: string;
        placeholderHTML?: string;
        customCode?: {
            importCode?: string;
            useCode?: string;
        };
    };
}

export declare interface ReplStore extends UnwrapRef<StoreState> {
    activeFile: File_2;
    /** Loading compiler */
    loading: boolean;
    init(): void;
    setActive(filename: string): void;
    addFile(filename: string | File_2): void;
    deleteFile(filename: string): void;
    renameFile(oldFilename: string, newFilename: string): void;
    getImportMap(): ImportMap;
    getTsConfig(): Record<string, any>;
    serialize(): string;
    deserialize(serializedState: string): void;
    getFiles(): Record<string, string>;
    setFiles(newFiles: Record<string, string>, mainFile?: string): Promise<void>;
}

export declare interface SFCOptions {
    script?: Partial<SFCScriptCompileOptions>;
    style?: Partial<SFCAsyncStyleCompileOptions>;
    template?: Partial<SFCTemplateCompileOptions>;
}

export declare type Store = Pick<ReplStore, 'files' | 'activeFile' | 'mainFile' | 'errors' | 'showOutput' | 'outputMode' | 'sfcOptions' | 'compiler' | 'vueVersion' | 'locale' | 'typescriptVersion' | 'dependencyVersion' | 'reloadLanguageTools' | 'init' | 'setActive' | 'addFile' | 'deleteFile' | 'renameFile' | 'getImportMap' | 'getTsConfig'>;

export declare type StoreState = ToRefs<{
    files: Record<string, File_2>;
    activeFilename: string;
    mainFile: string;
    template: {
        welcomeSFC?: string;
        newSFC?: string;
    };
    builtinImportMap: ImportMap;
    errors: (string | Error)[];
    showOutput: boolean;
    outputMode: OutputModes;
    sfcOptions: SFCOptions;
    /** `@vue/compiler-sfc` */
    compiler: typeof defaultCompiler;
    vueVersion: string | null;
    locale: string | undefined;
    typescriptVersion: string;
    /** \{ dependencyName: version \} */
    dependencyVersion: Record<string, string>;
    reloadLanguageTools?: (() => void) | undefined;
}>;

export declare function useStore({ files, activeFilename, // set later
    mainFile, template, builtinImportMap, // set later
    errors, showOutput, outputMode, sfcOptions, compiler, vueVersion, locale, typescriptVersion, dependencyVersion, reloadLanguageTools, }?: Partial<StoreState>, serializedState?: string): ReplStore;

export declare function useVueImportMap(defaults?: {
    runtimeDev?: string | (() => string);
    runtimeProd?: string | (() => string);
    serverRenderer?: string | (() => string);
    vueVersion?: string | null;
}): {
    productionMode: Ref<boolean>;
    importMap: ComputedRef<ImportMap>;
    vueVersion: Ref<string | null>;
    defaultVersion: string;
};

export { }
