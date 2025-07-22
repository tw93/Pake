/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Avoid circular dependency on EventEmitter by implementing a subset of the interface.
class ErrorHandler {
    constructor() {
        this.listeners = [];
        this.unexpectedErrorHandler = function (e) {
            setTimeout(() => {
                if (e.stack) {
                    if (ErrorNoTelemetry.isErrorNoTelemetry(e)) {
                        throw new ErrorNoTelemetry(e.message + '\n\n' + e.stack);
                    }
                    throw new Error(e.message + '\n\n' + e.stack);
                }
                throw e;
            }, 0);
        };
    }
    emit(e) {
        this.listeners.forEach((listener) => {
            listener(e);
        });
    }
    onUnexpectedError(e) {
        this.unexpectedErrorHandler(e);
        this.emit(e);
    }
    // For external errors, we don't want the listeners to be called
    onUnexpectedExternalError(e) {
        this.unexpectedErrorHandler(e);
    }
}
const errorHandler = new ErrorHandler();
function onUnexpectedError(e) {
    // ignore errors from cancelled promises
    if (!isCancellationError(e)) {
        errorHandler.onUnexpectedError(e);
    }
    return undefined;
}
function transformErrorForSerialization(error) {
    if (error instanceof Error) {
        const { name, message } = error;
        const stack = error.stacktrace || error.stack;
        return {
            $isError: true,
            name,
            message,
            stack,
            noTelemetry: ErrorNoTelemetry.isErrorNoTelemetry(error)
        };
    }
    // return as is
    return error;
}
const canceledName = 'Canceled';
/**
 * Checks if the given error is a promise in canceled state
 */
function isCancellationError(error) {
    if (error instanceof CancellationError) {
        return true;
    }
    return error instanceof Error && error.name === canceledName && error.message === canceledName;
}
// !!!IMPORTANT!!!
// Do NOT change this class because it is also used as an API-type.
class CancellationError extends Error {
    constructor() {
        super(canceledName);
        this.name = this.message;
    }
}
/**
 * Error that when thrown won't be logged in telemetry as an unhandled error.
 */
class ErrorNoTelemetry extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'CodeExpectedError';
    }
    static fromError(err) {
        if (err instanceof ErrorNoTelemetry) {
            return err;
        }
        const result = new ErrorNoTelemetry();
        result.message = err.message;
        result.stack = err.stack;
        return result;
    }
    static isErrorNoTelemetry(err) {
        return err.name === 'CodeExpectedError';
    }
}
/**
 * This error indicates a bug.
 * Do not throw this for invalid user input.
 * Only catch this error to recover gracefully from bugs.
 */
class BugIndicatingError extends Error {
    constructor(message) {
        super(message || 'An unexpected bug occurred.');
        Object.setPrototypeOf(this, BugIndicatingError.prototype);
        // Because we know for sure only buggy code throws this,
        // we definitely want to break here and fix the bug.
        // eslint-disable-next-line no-debugger
        // debugger;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Given a function, returns a function that is only calling that function once.
 */
function createSingleCallFunction(fn, fnDidRunCallback) {
    const _this = this;
    let didCall = false;
    let result;
    return function () {
        if (didCall) {
            return result;
        }
        didCall = true;
        {
            result = fn.apply(_this, arguments);
        }
        return result;
    };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var Iterable;
(function (Iterable) {
    function is(thing) {
        return thing && typeof thing === 'object' && typeof thing[Symbol.iterator] === 'function';
    }
    Iterable.is = is;
    const _empty = Object.freeze([]);
    function empty() {
        return _empty;
    }
    Iterable.empty = empty;
    function* single(element) {
        yield element;
    }
    Iterable.single = single;
    function wrap(iterableOrElement) {
        if (is(iterableOrElement)) {
            return iterableOrElement;
        }
        else {
            return single(iterableOrElement);
        }
    }
    Iterable.wrap = wrap;
    function from(iterable) {
        return iterable || _empty;
    }
    Iterable.from = from;
    function* reverse(array) {
        for (let i = array.length - 1; i >= 0; i--) {
            yield array[i];
        }
    }
    Iterable.reverse = reverse;
    function isEmpty(iterable) {
        return !iterable || iterable[Symbol.iterator]().next().done === true;
    }
    Iterable.isEmpty = isEmpty;
    function first(iterable) {
        return iterable[Symbol.iterator]().next().value;
    }
    Iterable.first = first;
    function some(iterable, predicate) {
        for (const element of iterable) {
            if (predicate(element)) {
                return true;
            }
        }
        return false;
    }
    Iterable.some = some;
    function find(iterable, predicate) {
        for (const element of iterable) {
            if (predicate(element)) {
                return element;
            }
        }
        return undefined;
    }
    Iterable.find = find;
    function* filter(iterable, predicate) {
        for (const element of iterable) {
            if (predicate(element)) {
                yield element;
            }
        }
    }
    Iterable.filter = filter;
    function* map(iterable, fn) {
        let index = 0;
        for (const element of iterable) {
            yield fn(element, index++);
        }
    }
    Iterable.map = map;
    function* concat(...iterables) {
        for (const iterable of iterables) {
            yield* iterable;
        }
    }
    Iterable.concat = concat;
    function reduce(iterable, reducer, initialValue) {
        let value = initialValue;
        for (const element of iterable) {
            value = reducer(value, element);
        }
        return value;
    }
    Iterable.reduce = reduce;
    /**
     * Returns an iterable slice of the array, with the same semantics as `array.slice()`.
     */
    function* slice(arr, from, to = arr.length) {
        if (from < 0) {
            from += arr.length;
        }
        if (to < 0) {
            to += arr.length;
        }
        else if (to > arr.length) {
            to = arr.length;
        }
        for (; from < to; from++) {
            yield arr[from];
        }
    }
    Iterable.slice = slice;
    /**
     * Consumes `atMost` elements from iterable and returns the consumed elements,
     * and an iterable for the rest of the elements.
     */
    function consume(iterable, atMost = Number.POSITIVE_INFINITY) {
        const consumed = [];
        if (atMost === 0) {
            return [consumed, iterable];
        }
        const iterator = iterable[Symbol.iterator]();
        for (let i = 0; i < atMost; i++) {
            const next = iterator.next();
            if (next.done) {
                return [consumed, Iterable.empty()];
            }
            consumed.push(next.value);
        }
        return [consumed, { [Symbol.iterator]() { return iterator; } }];
    }
    Iterable.consume = consume;
    async function asyncToArray(iterable) {
        const result = [];
        for await (const item of iterable) {
            result.push(item);
        }
        return Promise.resolve(result);
    }
    Iterable.asyncToArray = asyncToArray;
})(Iterable || (Iterable = {}));

function trackDisposable(x) {
    return x;
}
function setParentOfDisposable(child, parent) {
}
function dispose(arg) {
    if (Iterable.is(arg)) {
        const errors = [];
        for (const d of arg) {
            if (d) {
                try {
                    d.dispose();
                }
                catch (e) {
                    errors.push(e);
                }
            }
        }
        if (errors.length === 1) {
            throw errors[0];
        }
        else if (errors.length > 1) {
            throw new AggregateError(errors, 'Encountered errors while disposing of store');
        }
        return Array.isArray(arg) ? [] : arg;
    }
    else if (arg) {
        arg.dispose();
        return arg;
    }
}
/**
 * Combine multiple disposable values into a single {@link IDisposable}.
 */
function combinedDisposable(...disposables) {
    const parent = toDisposable(() => dispose(disposables));
    return parent;
}
/**
 * Turn a function that implements dispose into an {@link IDisposable}.
 *
 * @param fn Clean up function, guaranteed to be called only **once**.
 */
function toDisposable(fn) {
    const self = trackDisposable({
        dispose: createSingleCallFunction(() => {
            fn();
        })
    });
    return self;
}
/**
 * Manages a collection of disposable values.
 *
 * This is the preferred way to manage multiple disposables. A `DisposableStore` is safer to work with than an
 * `IDisposable[]` as it considers edge cases, such as registering the same value multiple times or adding an item to a
 * store that has already been disposed of.
 */
class DisposableStore {
    constructor() {
        this._toDispose = new Set();
        this._isDisposed = false;
    }
    /**
     * Dispose of all registered disposables and mark this object as disposed.
     *
     * Any future disposables added to this object will be disposed of on `add`.
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
        this.clear();
    }
    /**
     * @return `true` if this object has been disposed of.
     */
    get isDisposed() {
        return this._isDisposed;
    }
    /**
     * Dispose of all registered disposables but do not mark this object as disposed.
     */
    clear() {
        if (this._toDispose.size === 0) {
            return;
        }
        try {
            dispose(this._toDispose);
        }
        finally {
            this._toDispose.clear();
        }
    }
    /**
     * Add a new {@link IDisposable disposable} to the collection.
     */
    add(o) {
        if (!o) {
            return o;
        }
        if (o === this) {
            throw new Error('Cannot register a disposable on itself!');
        }
        if (this._isDisposed) {
            if (!DisposableStore.DISABLE_DISPOSED_WARNING) {
                console.warn(new Error('Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!').stack);
            }
        }
        else {
            this._toDispose.add(o);
        }
        return o;
    }
    /**
     * Deletes the value from the store, but does not dispose it.
     */
    deleteAndLeak(o) {
        if (!o) {
            return;
        }
        if (this._toDispose.has(o)) {
            this._toDispose.delete(o);
        }
    }
}
DisposableStore.DISABLE_DISPOSED_WARNING = false;
/**
 * Abstract base class for a {@link IDisposable disposable} object.
 *
 * Subclasses can {@linkcode _register} disposables that will be automatically cleaned up when this object is disposed of.
 */
class Disposable {
    constructor() {
        this._store = new DisposableStore();
        setParentOfDisposable(this._store);
    }
    dispose() {
        this._store.dispose();
    }
    /**
     * Adds `o` to the collection of disposables managed by this object.
     */
    _register(o) {
        if (o === this) {
            throw new Error('Cannot register a disposable on itself!');
        }
        return this._store.add(o);
    }
}
/**
 * A disposable that does nothing when it is disposed of.
 *
 * TODO: This should not be a static property.
 */
Disposable.None = Object.freeze({ dispose() { } });

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class Node {
    constructor(element) {
        this.element = element;
        this.next = Node.Undefined;
        this.prev = Node.Undefined;
    }
}
Node.Undefined = new Node(undefined);
class LinkedList {
    constructor() {
        this._first = Node.Undefined;
        this._last = Node.Undefined;
        this._size = 0;
    }
    get size() {
        return this._size;
    }
    isEmpty() {
        return this._first === Node.Undefined;
    }
    clear() {
        let node = this._first;
        while (node !== Node.Undefined) {
            const next = node.next;
            node.prev = Node.Undefined;
            node.next = Node.Undefined;
            node = next;
        }
        this._first = Node.Undefined;
        this._last = Node.Undefined;
        this._size = 0;
    }
    unshift(element) {
        return this._insert(element, false);
    }
    push(element) {
        return this._insert(element, true);
    }
    _insert(element, atTheEnd) {
        const newNode = new Node(element);
        if (this._first === Node.Undefined) {
            this._first = newNode;
            this._last = newNode;
        }
        else if (atTheEnd) {
            // push
            const oldLast = this._last;
            this._last = newNode;
            newNode.prev = oldLast;
            oldLast.next = newNode;
        }
        else {
            // unshift
            const oldFirst = this._first;
            this._first = newNode;
            newNode.next = oldFirst;
            oldFirst.prev = newNode;
        }
        this._size += 1;
        let didRemove = false;
        return () => {
            if (!didRemove) {
                didRemove = true;
                this._remove(newNode);
            }
        };
    }
    shift() {
        if (this._first === Node.Undefined) {
            return undefined;
        }
        else {
            const res = this._first.element;
            this._remove(this._first);
            return res;
        }
    }
    pop() {
        if (this._last === Node.Undefined) {
            return undefined;
        }
        else {
            const res = this._last.element;
            this._remove(this._last);
            return res;
        }
    }
    _remove(node) {
        if (node.prev !== Node.Undefined && node.next !== Node.Undefined) {
            // middle
            const anchor = node.prev;
            anchor.next = node.next;
            node.next.prev = anchor;
        }
        else if (node.prev === Node.Undefined && node.next === Node.Undefined) {
            // only node
            this._first = Node.Undefined;
            this._last = Node.Undefined;
        }
        else if (node.next === Node.Undefined) {
            // last
            this._last = this._last.prev;
            this._last.next = Node.Undefined;
        }
        else if (node.prev === Node.Undefined) {
            // first
            this._first = this._first.next;
            this._first.prev = Node.Undefined;
        }
        // done
        this._size -= 1;
    }
    *[Symbol.iterator]() {
        let node = this._first;
        while (node !== Node.Undefined) {
            yield node.element;
            node = node.next;
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const hasPerformanceNow = (globalThis.performance && typeof globalThis.performance.now === 'function');
class StopWatch {
    static create(highResolution) {
        return new StopWatch(highResolution);
    }
    constructor(highResolution) {
        this._now = hasPerformanceNow && highResolution === false ? Date.now : globalThis.performance.now.bind(globalThis.performance);
        this._startTime = this._now();
        this._stopTime = -1;
    }
    stop() {
        this._stopTime = this._now();
    }
    reset() {
        this._startTime = this._now();
        this._stopTime = -1;
    }
    elapsed() {
        if (this._stopTime !== -1) {
            return this._stopTime - this._startTime;
        }
        return this._now() - this._startTime;
    }
}

var Event;
(function (Event) {
    Event.None = () => Disposable.None;
    /**
     * Given an event, returns another event which debounces calls and defers the listeners to a later task via a shared
     * `setTimeout`. The event is converted into a signal (`Event<void>`) to avoid additional object creation as a
     * result of merging events and to try prevent race conditions that could arise when using related deferred and
     * non-deferred events.
     *
     * This is useful for deferring non-critical work (eg. general UI updates) to ensure it does not block critical work
     * (eg. latency of keypress to text rendered).
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function defer(event, disposable) {
        return debounce(event, () => void 0, 0, undefined, true, undefined, disposable);
    }
    Event.defer = defer;
    /**
     * Given an event, returns another event which only fires once.
     *
     * @param event The event source for the new event.
     */
    function once(event) {
        return (listener, thisArgs = null, disposables) => {
            // we need this, in case the event fires during the listener call
            let didFire = false;
            let result = undefined;
            result = event(e => {
                if (didFire) {
                    return;
                }
                else if (result) {
                    result.dispose();
                }
                else {
                    didFire = true;
                }
                return listener.call(thisArgs, e);
            }, null, disposables);
            if (didFire) {
                result.dispose();
            }
            return result;
        };
    }
    Event.once = once;
    /**
     * Maps an event of one type into an event of another type using a mapping function, similar to how
     * `Array.prototype.map` works.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param map The mapping function.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function map(event, map, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(i => listener.call(thisArgs, map(i)), null, disposables), disposable);
    }
    Event.map = map;
    /**
     * Wraps an event in another event that performs some function on the event object before firing.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param each The function to perform on the event object.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function forEach(event, each, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(i => { each(i); listener.call(thisArgs, i); }, null, disposables), disposable);
    }
    Event.forEach = forEach;
    function filter(event, filter, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables), disposable);
    }
    Event.filter = filter;
    /**
     * Given an event, returns the same event but typed as `Event<void>`.
     */
    function signal(event) {
        return event;
    }
    Event.signal = signal;
    function any(...events) {
        return (listener, thisArgs = null, disposables) => {
            const disposable = combinedDisposable(...events.map(event => event(e => listener.call(thisArgs, e))));
            return addAndReturnDisposable(disposable, disposables);
        };
    }
    Event.any = any;
    /**
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     */
    function reduce(event, merge, initial, disposable) {
        let output = initial;
        return map(event, e => {
            output = merge(output, e);
            return output;
        }, disposable);
    }
    Event.reduce = reduce;
    function snapshot(event, disposable) {
        let listener;
        const options = {
            onWillAddFirstListener() {
                listener = event(emitter.fire, emitter);
            },
            onDidRemoveLastListener() {
                listener === null || listener === void 0 ? void 0 : listener.dispose();
            }
        };
        const emitter = new Emitter(options);
        disposable === null || disposable === void 0 ? void 0 : disposable.add(emitter);
        return emitter.event;
    }
    /**
     * Adds the IDisposable to the store if it's set, and returns it. Useful to
     * Event function implementation.
     */
    function addAndReturnDisposable(d, store) {
        if (store instanceof Array) {
            store.push(d);
        }
        else if (store) {
            store.add(d);
        }
        return d;
    }
    function debounce(event, merge, delay = 100, leading = false, flushOnListenerRemove = false, leakWarningThreshold, disposable) {
        let subscription;
        let output = undefined;
        let handle = undefined;
        let numDebouncedCalls = 0;
        let doFire;
        const options = {
            leakWarningThreshold,
            onWillAddFirstListener() {
                subscription = event(cur => {
                    numDebouncedCalls++;
                    output = merge(output, cur);
                    if (leading && !handle) {
                        emitter.fire(output);
                        output = undefined;
                    }
                    doFire = () => {
                        const _output = output;
                        output = undefined;
                        handle = undefined;
                        if (!leading || numDebouncedCalls > 1) {
                            emitter.fire(_output);
                        }
                        numDebouncedCalls = 0;
                    };
                    if (typeof delay === 'number') {
                        clearTimeout(handle);
                        handle = setTimeout(doFire, delay);
                    }
                    else {
                        if (handle === undefined) {
                            handle = 0;
                            queueMicrotask(doFire);
                        }
                    }
                });
            },
            onWillRemoveListener() {
                if (flushOnListenerRemove && numDebouncedCalls > 0) {
                    doFire === null || doFire === void 0 ? void 0 : doFire();
                }
            },
            onDidRemoveLastListener() {
                doFire = undefined;
                subscription.dispose();
            }
        };
        const emitter = new Emitter(options);
        disposable === null || disposable === void 0 ? void 0 : disposable.add(emitter);
        return emitter.event;
    }
    Event.debounce = debounce;
    /**
     * Debounces an event, firing after some delay (default=0) with an array of all event original objects.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     */
    function accumulate(event, delay = 0, disposable) {
        return Event.debounce(event, (last, e) => {
            if (!last) {
                return [e];
            }
            last.push(e);
            return last;
        }, delay, undefined, true, undefined, disposable);
    }
    Event.accumulate = accumulate;
    /**
     * Filters an event such that some condition is _not_ met more than once in a row, effectively ensuring duplicate
     * event objects from different sources do not fire the same event object.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param equals The equality condition.
     * @param disposable A disposable store to add the new EventEmitter to.
     *
     * @example
     * ```
     * // Fire only one time when a single window is opened or focused
     * Event.latch(Event.any(onDidOpenWindow, onDidFocusWindow))
     * ```
     */
    function latch(event, equals = (a, b) => a === b, disposable) {
        let firstCall = true;
        let cache;
        return filter(event, value => {
            const shouldEmit = firstCall || !equals(value, cache);
            firstCall = false;
            cache = value;
            return shouldEmit;
        }, disposable);
    }
    Event.latch = latch;
    /**
     * Splits an event whose parameter is a union type into 2 separate events for each type in the union.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @example
     * ```
     * const event = new EventEmitter<number | undefined>().event;
     * const [numberEvent, undefinedEvent] = Event.split(event, isUndefined);
     * ```
     *
     * @param event The event source for the new event.
     * @param isT A function that determines what event is of the first type.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function split(event, isT, disposable) {
        return [
            Event.filter(event, isT, disposable),
            Event.filter(event, e => !isT(e), disposable),
        ];
    }
    Event.split = split;
    /**
     * Buffers an event until it has a listener attached.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param flushAfterTimeout Determines whether to flush the buffer after a timeout immediately or after a
     * `setTimeout` when the first event listener is added.
     * @param _buffer Internal: A source event array used for tests.
     *
     * @example
     * ```
     * // Start accumulating events, when the first listener is attached, flush
     * // the event after a timeout such that multiple listeners attached before
     * // the timeout would receive the event
     * this.onInstallExtension = Event.buffer(service.onInstallExtension, true);
     * ```
     */
    function buffer(event, flushAfterTimeout = false, _buffer = [], disposable) {
        let buffer = _buffer.slice();
        let listener = event(e => {
            if (buffer) {
                buffer.push(e);
            }
            else {
                emitter.fire(e);
            }
        });
        if (disposable) {
            disposable.add(listener);
        }
        const flush = () => {
            buffer === null || buffer === void 0 ? void 0 : buffer.forEach(e => emitter.fire(e));
            buffer = null;
        };
        const emitter = new Emitter({
            onWillAddFirstListener() {
                if (!listener) {
                    listener = event(e => emitter.fire(e));
                    if (disposable) {
                        disposable.add(listener);
                    }
                }
            },
            onDidAddFirstListener() {
                if (buffer) {
                    if (flushAfterTimeout) {
                        setTimeout(flush);
                    }
                    else {
                        flush();
                    }
                }
            },
            onDidRemoveLastListener() {
                if (listener) {
                    listener.dispose();
                }
                listener = null;
            }
        });
        if (disposable) {
            disposable.add(emitter);
        }
        return emitter.event;
    }
    Event.buffer = buffer;
    /**
     * Wraps the event in an {@link IChainableEvent}, allowing a more functional programming style.
     *
     * @example
     * ```
     * // Normal
     * const onEnterPressNormal = Event.filter(
     *   Event.map(onKeyPress.event, e => new StandardKeyboardEvent(e)),
     *   e.keyCode === KeyCode.Enter
     * ).event;
     *
     * // Using chain
     * const onEnterPressChain = Event.chain(onKeyPress.event, $ => $
     *   .map(e => new StandardKeyboardEvent(e))
     *   .filter(e => e.keyCode === KeyCode.Enter)
     * );
     * ```
     */
    function chain(event, sythensize) {
        const fn = (listener, thisArgs, disposables) => {
            const cs = sythensize(new ChainableSynthesis());
            return event(function (value) {
                const result = cs.evaluate(value);
                if (result !== HaltChainable) {
                    listener.call(thisArgs, result);
                }
            }, undefined, disposables);
        };
        return fn;
    }
    Event.chain = chain;
    const HaltChainable = Symbol('HaltChainable');
    class ChainableSynthesis {
        constructor() {
            this.steps = [];
        }
        map(fn) {
            this.steps.push(fn);
            return this;
        }
        forEach(fn) {
            this.steps.push(v => {
                fn(v);
                return v;
            });
            return this;
        }
        filter(fn) {
            this.steps.push(v => fn(v) ? v : HaltChainable);
            return this;
        }
        reduce(merge, initial) {
            let last = initial;
            this.steps.push(v => {
                last = merge(last, v);
                return last;
            });
            return this;
        }
        latch(equals = (a, b) => a === b) {
            let firstCall = true;
            let cache;
            this.steps.push(value => {
                const shouldEmit = firstCall || !equals(value, cache);
                firstCall = false;
                cache = value;
                return shouldEmit ? value : HaltChainable;
            });
            return this;
        }
        evaluate(value) {
            for (const step of this.steps) {
                value = step(value);
                if (value === HaltChainable) {
                    break;
                }
            }
            return value;
        }
    }
    /**
     * Creates an {@link Event} from a node event emitter.
     */
    function fromNodeEventEmitter(emitter, eventName, map = id => id) {
        const fn = (...args) => result.fire(map(...args));
        const onFirstListenerAdd = () => emitter.on(eventName, fn);
        const onLastListenerRemove = () => emitter.removeListener(eventName, fn);
        const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
        return result.event;
    }
    Event.fromNodeEventEmitter = fromNodeEventEmitter;
    /**
     * Creates an {@link Event} from a DOM event emitter.
     */
    function fromDOMEventEmitter(emitter, eventName, map = id => id) {
        const fn = (...args) => result.fire(map(...args));
        const onFirstListenerAdd = () => emitter.addEventListener(eventName, fn);
        const onLastListenerRemove = () => emitter.removeEventListener(eventName, fn);
        const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
        return result.event;
    }
    Event.fromDOMEventEmitter = fromDOMEventEmitter;
    /**
     * Creates a promise out of an event, using the {@link Event.once} helper.
     */
    function toPromise(event) {
        return new Promise(resolve => once(event)(resolve));
    }
    Event.toPromise = toPromise;
    /**
     * Creates an event out of a promise that fires once when the promise is
     * resolved with the result of the promise or `undefined`.
     */
    function fromPromise(promise) {
        const result = new Emitter();
        promise.then(res => {
            result.fire(res);
        }, () => {
            result.fire(undefined);
        }).finally(() => {
            result.dispose();
        });
        return result.event;
    }
    Event.fromPromise = fromPromise;
    function runAndSubscribe(event, handler, initial) {
        handler(initial);
        return event(e => handler(e));
    }
    Event.runAndSubscribe = runAndSubscribe;
    class EmitterObserver {
        constructor(_observable, store) {
            this._observable = _observable;
            this._counter = 0;
            this._hasChanged = false;
            const options = {
                onWillAddFirstListener: () => {
                    _observable.addObserver(this);
                },
                onDidRemoveLastListener: () => {
                    _observable.removeObserver(this);
                }
            };
            this.emitter = new Emitter(options);
            if (store) {
                store.add(this.emitter);
            }
        }
        beginUpdate(_observable) {
            // assert(_observable === this.obs);
            this._counter++;
        }
        handlePossibleChange(_observable) {
            // assert(_observable === this.obs);
        }
        handleChange(_observable, _change) {
            // assert(_observable === this.obs);
            this._hasChanged = true;
        }
        endUpdate(_observable) {
            // assert(_observable === this.obs);
            this._counter--;
            if (this._counter === 0) {
                this._observable.reportChanges();
                if (this._hasChanged) {
                    this._hasChanged = false;
                    this.emitter.fire(this._observable.get());
                }
            }
        }
    }
    /**
     * Creates an event emitter that is fired when the observable changes.
     * Each listeners subscribes to the emitter.
     */
    function fromObservable(obs, store) {
        const observer = new EmitterObserver(obs, store);
        return observer.emitter.event;
    }
    Event.fromObservable = fromObservable;
    /**
     * Each listener is attached to the observable directly.
     */
    function fromObservableLight(observable) {
        return (listener, thisArgs, disposables) => {
            let count = 0;
            let didChange = false;
            const observer = {
                beginUpdate() {
                    count++;
                },
                endUpdate() {
                    count--;
                    if (count === 0) {
                        observable.reportChanges();
                        if (didChange) {
                            didChange = false;
                            listener.call(thisArgs);
                        }
                    }
                },
                handlePossibleChange() {
                    // noop
                },
                handleChange() {
                    didChange = true;
                }
            };
            observable.addObserver(observer);
            observable.reportChanges();
            const disposable = {
                dispose() {
                    observable.removeObserver(observer);
                }
            };
            if (disposables instanceof DisposableStore) {
                disposables.add(disposable);
            }
            else if (Array.isArray(disposables)) {
                disposables.push(disposable);
            }
            return disposable;
        };
    }
    Event.fromObservableLight = fromObservableLight;
})(Event || (Event = {}));
class EventProfiling {
    constructor(name) {
        this.listenerCount = 0;
        this.invocationCount = 0;
        this.elapsedOverall = 0;
        this.durations = [];
        this.name = `${name}_${EventProfiling._idPool++}`;
        EventProfiling.all.add(this);
    }
    start(listenerCount) {
        this._stopWatch = new StopWatch();
        this.listenerCount = listenerCount;
    }
    stop() {
        if (this._stopWatch) {
            const elapsed = this._stopWatch.elapsed();
            this.durations.push(elapsed);
            this.elapsedOverall += elapsed;
            this.invocationCount += 1;
            this._stopWatch = undefined;
        }
    }
}
EventProfiling.all = new Set();
EventProfiling._idPool = 0;
let _globalLeakWarningThreshold = -1;
class LeakageMonitor {
    constructor(_errorHandler, threshold, name = Math.random().toString(18).slice(2, 5)) {
        this._errorHandler = _errorHandler;
        this.threshold = threshold;
        this.name = name;
        this._warnCountdown = 0;
    }
    dispose() {
        var _a;
        (_a = this._stacks) === null || _a === void 0 ? void 0 : _a.clear();
    }
    check(stack, listenerCount) {
        const threshold = this.threshold;
        if (threshold <= 0 || listenerCount < threshold) {
            return undefined;
        }
        if (!this._stacks) {
            this._stacks = new Map();
        }
        const count = (this._stacks.get(stack.value) || 0);
        this._stacks.set(stack.value, count + 1);
        this._warnCountdown -= 1;
        if (this._warnCountdown <= 0) {
            // only warn on first exceed and then every time the limit
            // is exceeded by 50% again
            this._warnCountdown = threshold * 0.5;
            const [topStack, topCount] = this.getMostFrequentStack();
            const message = `[${this.name}] potential listener LEAK detected, having ${listenerCount} listeners already. MOST frequent listener (${topCount}):`;
            console.warn(message);
            console.warn(topStack);
            const error = new ListenerLeakError(message, topStack);
            this._errorHandler(error);
        }
        return () => {
            const count = (this._stacks.get(stack.value) || 0);
            this._stacks.set(stack.value, count - 1);
        };
    }
    getMostFrequentStack() {
        if (!this._stacks) {
            return undefined;
        }
        let topStack;
        let topCount = 0;
        for (const [stack, count] of this._stacks) {
            if (!topStack || topCount < count) {
                topStack = [stack, count];
                topCount = count;
            }
        }
        return topStack;
    }
}
class Stacktrace {
    static create() {
        var _a;
        const err = new Error();
        return new Stacktrace((_a = err.stack) !== null && _a !== void 0 ? _a : '');
    }
    constructor(value) {
        this.value = value;
    }
    print() {
        console.warn(this.value.split('\n').slice(2).join('\n'));
    }
}
// error that is logged when going over the configured listener threshold
class ListenerLeakError extends Error {
    constructor(message, stack) {
        super(message);
        this.name = 'ListenerLeakError';
        this.stack = stack;
    }
}
// SEVERE error that is logged when having gone way over the configured listener
// threshold so that the emitter refuses to accept more listeners
class ListenerRefusalError extends Error {
    constructor(message, stack) {
        super(message);
        this.name = 'ListenerRefusalError';
        this.stack = stack;
    }
}
class UniqueContainer {
    constructor(value) {
        this.value = value;
    }
}
const compactionThreshold = 2;
/**
 * The Emitter can be used to expose an Event to the public
 * to fire it from the insides.
 * Sample:
    class Document {

        private readonly _onDidChange = new Emitter<(value:string)=>any>();

        public onDidChange = this._onDidChange.event;

        // getter-style
        // get onDidChange(): Event<(value:string)=>any> {
        // 	return this._onDidChange.event;
        // }

        private _doIt() {
            //...
            this._onDidChange.fire(value);
        }
    }
 */
class Emitter {
    constructor(options) {
        var _a, _b, _c, _d, _e, _f;
        this._size = 0;
        this._options = options;
        this._leakageMon = (((_a = this._options) === null || _a === void 0 ? void 0 : _a.leakWarningThreshold))
            ? new LeakageMonitor((_b = options === null || options === void 0 ? void 0 : options.onListenerError) !== null && _b !== void 0 ? _b : onUnexpectedError, (_d = (_c = this._options) === null || _c === void 0 ? void 0 : _c.leakWarningThreshold) !== null && _d !== void 0 ? _d : _globalLeakWarningThreshold) :
            undefined;
        this._perfMon = ((_e = this._options) === null || _e === void 0 ? void 0 : _e._profName) ? new EventProfiling(this._options._profName) : undefined;
        this._deliveryQueue = (_f = this._options) === null || _f === void 0 ? void 0 : _f.deliveryQueue;
    }
    dispose() {
        var _a, _b, _c, _d;
        if (!this._disposed) {
            this._disposed = true;
            // It is bad to have listeners at the time of disposing an emitter, it is worst to have listeners keep the emitter
            // alive via the reference that's embedded in their disposables. Therefore we loop over all remaining listeners and
            // unset their subscriptions/disposables. Looping and blaming remaining listeners is done on next tick because the
            // the following programming pattern is very popular:
            //
            // const someModel = this._disposables.add(new ModelObject()); // (1) create and register model
            // this._disposables.add(someModel.onDidChange(() => { ... }); // (2) subscribe and register model-event listener
            // ...later...
            // this._disposables.dispose(); disposes (1) then (2): don't warn after (1) but after the "overall dispose" is done
            if (((_a = this._deliveryQueue) === null || _a === void 0 ? void 0 : _a.current) === this) {
                this._deliveryQueue.reset();
            }
            if (this._listeners) {
                this._listeners = undefined;
                this._size = 0;
            }
            (_c = (_b = this._options) === null || _b === void 0 ? void 0 : _b.onDidRemoveLastListener) === null || _c === void 0 ? void 0 : _c.call(_b);
            (_d = this._leakageMon) === null || _d === void 0 ? void 0 : _d.dispose();
        }
    }
    /**
     * For the public to allow to subscribe
     * to events from this Emitter
     */
    get event() {
        var _a;
        (_a = this._event) !== null && _a !== void 0 ? _a : (this._event = (callback, thisArgs, disposables) => {
            var _a, _b, _c, _d, _e, _f, _g;
            if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
                const message = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
                console.warn(message);
                const tuple = (_a = this._leakageMon.getMostFrequentStack()) !== null && _a !== void 0 ? _a : ['UNKNOWN stack', -1];
                const error = new ListenerRefusalError(`${message}. HINT: Stack shows most frequent listener (${tuple[1]}-times)`, tuple[0]);
                const errorHandler = ((_b = this._options) === null || _b === void 0 ? void 0 : _b.onListenerError) || onUnexpectedError;
                errorHandler(error);
                return Disposable.None;
            }
            if (this._disposed) {
                // todo: should we warn if a listener is added to a disposed emitter? This happens often
                return Disposable.None;
            }
            if (thisArgs) {
                callback = callback.bind(thisArgs);
            }
            const contained = new UniqueContainer(callback);
            let removeMonitor;
            if (this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * 0.2)) {
                // check and record this emitter for potential leakage
                contained.stack = Stacktrace.create();
                removeMonitor = this._leakageMon.check(contained.stack, this._size + 1);
            }
            if (!this._listeners) {
                (_d = (_c = this._options) === null || _c === void 0 ? void 0 : _c.onWillAddFirstListener) === null || _d === void 0 ? void 0 : _d.call(_c, this);
                this._listeners = contained;
                (_f = (_e = this._options) === null || _e === void 0 ? void 0 : _e.onDidAddFirstListener) === null || _f === void 0 ? void 0 : _f.call(_e, this);
            }
            else if (this._listeners instanceof UniqueContainer) {
                (_g = this._deliveryQueue) !== null && _g !== void 0 ? _g : (this._deliveryQueue = new EventDeliveryQueuePrivate());
                this._listeners = [this._listeners, contained];
            }
            else {
                this._listeners.push(contained);
            }
            this._size++;
            const result = toDisposable(() => {
                removeMonitor === null || removeMonitor === void 0 ? void 0 : removeMonitor();
                this._removeListener(contained);
            });
            if (disposables instanceof DisposableStore) {
                disposables.add(result);
            }
            else if (Array.isArray(disposables)) {
                disposables.push(result);
            }
            return result;
        });
        return this._event;
    }
    _removeListener(listener) {
        var _a, _b, _c, _d;
        (_b = (_a = this._options) === null || _a === void 0 ? void 0 : _a.onWillRemoveListener) === null || _b === void 0 ? void 0 : _b.call(_a, this);
        if (!this._listeners) {
            return; // expected if a listener gets disposed
        }
        if (this._size === 1) {
            this._listeners = undefined;
            (_d = (_c = this._options) === null || _c === void 0 ? void 0 : _c.onDidRemoveLastListener) === null || _d === void 0 ? void 0 : _d.call(_c, this);
            this._size = 0;
            return;
        }
        // size > 1 which requires that listeners be a list:
        const listeners = this._listeners;
        const index = listeners.indexOf(listener);
        if (index === -1) {
            console.log('disposed?', this._disposed);
            console.log('size?', this._size);
            console.log('arr?', JSON.stringify(this._listeners));
            throw new Error('Attempted to dispose unknown listener');
        }
        this._size--;
        listeners[index] = undefined;
        const adjustDeliveryQueue = this._deliveryQueue.current === this;
        if (this._size * compactionThreshold <= listeners.length) {
            let n = 0;
            for (let i = 0; i < listeners.length; i++) {
                if (listeners[i]) {
                    listeners[n++] = listeners[i];
                }
                else if (adjustDeliveryQueue) {
                    this._deliveryQueue.end--;
                    if (n < this._deliveryQueue.i) {
                        this._deliveryQueue.i--;
                    }
                }
            }
            listeners.length = n;
        }
    }
    _deliver(listener, value) {
        var _a;
        if (!listener) {
            return;
        }
        const errorHandler = ((_a = this._options) === null || _a === void 0 ? void 0 : _a.onListenerError) || onUnexpectedError;
        if (!errorHandler) {
            listener.value(value);
            return;
        }
        try {
            listener.value(value);
        }
        catch (e) {
            errorHandler(e);
        }
    }
    /** Delivers items in the queue. Assumes the queue is ready to go. */
    _deliverQueue(dq) {
        const listeners = dq.current._listeners;
        while (dq.i < dq.end) {
            // important: dq.i is incremented before calling deliver() because it might reenter deliverQueue()
            this._deliver(listeners[dq.i++], dq.value);
        }
        dq.reset();
    }
    /**
     * To be kept private to fire an event to
     * subscribers
     */
    fire(event) {
        var _a, _b, _c, _d;
        if ((_a = this._deliveryQueue) === null || _a === void 0 ? void 0 : _a.current) {
            this._deliverQueue(this._deliveryQueue);
            (_b = this._perfMon) === null || _b === void 0 ? void 0 : _b.stop(); // last fire() will have starting perfmon, stop it before starting the next dispatch
        }
        (_c = this._perfMon) === null || _c === void 0 ? void 0 : _c.start(this._size);
        if (!this._listeners) ;
        else if (this._listeners instanceof UniqueContainer) {
            this._deliver(this._listeners, event);
        }
        else {
            const dq = this._deliveryQueue;
            dq.enqueue(this, event, this._listeners.length);
            this._deliverQueue(dq);
        }
        (_d = this._perfMon) === null || _d === void 0 ? void 0 : _d.stop();
    }
    hasListeners() {
        return this._size > 0;
    }
}
class EventDeliveryQueuePrivate {
    constructor() {
        /**
         * Index in current's listener list.
         */
        this.i = -1;
        /**
         * The last index in the listener's list to deliver.
         */
        this.end = 0;
    }
    enqueue(emitter, value, end) {
        this.i = 0;
        this.end = end;
        this.current = emitter;
        this.value = value;
    }
    reset() {
        this.i = this.end; // force any current emission loop to stop, mainly for during dispose
        this.current = undefined;
        this.value = undefined;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
function isString(str) {
    return (typeof str === 'string');
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function getAllPropertyNames(obj) {
    let res = [];
    while (Object.prototype !== obj) {
        res = res.concat(Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
    }
    return res;
}
function getAllMethodNames(obj) {
    const methods = [];
    for (const prop of getAllPropertyNames(obj)) {
        if (typeof obj[prop] === 'function') {
            methods.push(prop);
        }
    }
    return methods;
}
function createProxyObject$1(methodNames, invoke) {
    const createProxyMethod = (method) => {
        return function () {
            const args = Array.prototype.slice.call(arguments, 0);
            return invoke(method, args);
        };
    };
    const result = {};
    for (const methodName of methodNames) {
        result[methodName] = createProxyMethod(methodName);
    }
    return result;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
let isPseudo = (typeof document !== 'undefined' && document.location && document.location.hash.indexOf('pseudo=true') >= 0);
function _format$1(message, args) {
    let result;
    if (args.length === 0) {
        result = message;
    }
    else {
        result = message.replace(/\{(\d+)\}/g, (match, rest) => {
            const index = rest[0];
            const arg = args[index];
            let result = match;
            if (typeof arg === 'string') {
                result = arg;
            }
            else if (typeof arg === 'number' || typeof arg === 'boolean' || arg === void 0 || arg === null) {
                result = String(arg);
            }
            return result;
        });
    }
    if (isPseudo) {
        // FF3B and FF3D is the Unicode zenkaku representation for [ and ]
        result = '\uFF3B' + result.replace(/[aouei]/g, '$&$&') + '\uFF3D';
    }
    return result;
}
/**
 * @skipMangle
 */
function localize(data, message, ...args) {
    return _format$1(message, args);
}
/**
 * @skipMangle
 */
function getConfiguredDefaultLocale(_) {
    // This returns undefined because this implementation isn't used and is overwritten by the loader
    // when loaded.
    return undefined;
}

var _a$1, _b$1;
const LANGUAGE_DEFAULT = 'en';
let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;
let _locale = undefined;
let _language = LANGUAGE_DEFAULT;
let _platformLocale = LANGUAGE_DEFAULT;
let _translationsConfigFile = undefined;
let _userAgent = undefined;
const $globalThis = globalThis;
let nodeProcess = undefined;
if (typeof $globalThis.vscode !== 'undefined' && typeof $globalThis.vscode.process !== 'undefined') {
    // Native environment (sandboxed)
    nodeProcess = $globalThis.vscode.process;
}
else if (typeof process !== 'undefined' && typeof ((_a$1 = process === null || process === void 0 ? void 0 : process.versions) === null || _a$1 === void 0 ? void 0 : _a$1.node) === 'string') {
    // Native environment (non-sandboxed)
    nodeProcess = process;
}
const isElectronProcess = typeof ((_b$1 = nodeProcess === null || nodeProcess === void 0 ? void 0 : nodeProcess.versions) === null || _b$1 === void 0 ? void 0 : _b$1.electron) === 'string';
const isElectronRenderer = isElectronProcess && (nodeProcess === null || nodeProcess === void 0 ? void 0 : nodeProcess.type) === 'renderer';
// Native environment
if (typeof nodeProcess === 'object') {
    _isWindows = (nodeProcess.platform === 'win32');
    _isMacintosh = (nodeProcess.platform === 'darwin');
    _isLinux = (nodeProcess.platform === 'linux');
    _isLinux && !!nodeProcess.env['SNAP'] && !!nodeProcess.env['SNAP_REVISION'];
    !!nodeProcess.env['CI'] || !!nodeProcess.env['BUILD_ARTIFACTSTAGINGDIRECTORY'];
    _locale = LANGUAGE_DEFAULT;
    _language = LANGUAGE_DEFAULT;
    const rawNlsConfig = nodeProcess.env['VSCODE_NLS_CONFIG'];
    if (rawNlsConfig) {
        try {
            const nlsConfig = JSON.parse(rawNlsConfig);
            const resolved = nlsConfig.availableLanguages['*'];
            _locale = nlsConfig.locale;
            _platformLocale = nlsConfig.osLocale;
            // VSCode's default language is 'en'
            _language = resolved ? resolved : LANGUAGE_DEFAULT;
            _translationsConfigFile = nlsConfig._translationsConfigFile;
        }
        catch (e) {
        }
    }
}
// Web environment
else if (typeof navigator === 'object' && !isElectronRenderer) {
    _userAgent = navigator.userAgent;
    _isWindows = _userAgent.indexOf('Windows') >= 0;
    _isMacintosh = _userAgent.indexOf('Macintosh') >= 0;
    (_userAgent.indexOf('Macintosh') >= 0 || _userAgent.indexOf('iPad') >= 0 || _userAgent.indexOf('iPhone') >= 0) && !!navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
    _isLinux = _userAgent.indexOf('Linux') >= 0;
    (_userAgent === null || _userAgent === void 0 ? void 0 : _userAgent.indexOf('Mobi')) >= 0;
    getConfiguredDefaultLocale(
    // This call _must_ be done in the file that calls `nls.getConfiguredDefaultLocale`
    // to ensure that the NLS AMD Loader plugin has been loaded and configured.
    // This is because the loader plugin decides what the default locale is based on
    // how it's able to resolve the strings.
    localize({ key: 'ensureLoaderPluginIsLoaded', comment: ['{Locked}'] }, '_'));
    _locale = LANGUAGE_DEFAULT;
    _language = _locale;
    _platformLocale = navigator.language;
}
// Unknown environment
else {
    console.error('Unable to resolve platform.');
}
const isWindows = _isWindows;
const isMacintosh = _isMacintosh;
const userAgent = _userAgent;
const setTimeout0IsFaster = (typeof $globalThis.postMessage === 'function' && !$globalThis.importScripts);
/**
 * See https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#:~:text=than%204%2C%20then-,set%20timeout%20to%204,-.
 *
 * Works similarly to `setTimeout(0)` but doesn't suffer from the 4ms artificial delay
 * that browsers set when the nesting level is > 5.
 */
(() => {
    if (setTimeout0IsFaster) {
        const pending = [];
        $globalThis.addEventListener('message', (e) => {
            if (e.data && e.data.vscodeScheduleAsyncWork) {
                for (let i = 0, len = pending.length; i < len; i++) {
                    const candidate = pending[i];
                    if (candidate.id === e.data.vscodeScheduleAsyncWork) {
                        pending.splice(i, 1);
                        candidate.callback();
                        return;
                    }
                }
            }
        });
        let lastId = 0;
        return (callback) => {
            const myId = ++lastId;
            pending.push({
                id: myId,
                callback: callback
            });
            $globalThis.postMessage({ vscodeScheduleAsyncWork: myId }, '*');
        };
    }
    return (callback) => setTimeout(callback);
})();
const isChrome = !!(userAgent && userAgent.indexOf('Chrome') >= 0);
!!(userAgent && userAgent.indexOf('Firefox') >= 0);
!!(!isChrome && (userAgent && userAgent.indexOf('Safari') >= 0));
!!(userAgent && userAgent.indexOf('Edg/') >= 0);
!!(userAgent && userAgent.indexOf('Android') >= 0);

function identity(t) {
    return t;
}
/**
 * Uses a LRU cache to make a given parametrized function cached.
 * Caches just the last key/value.
*/
class LRUCachedFunction {
    constructor(arg1, arg2) {
        this.lastCache = undefined;
        this.lastArgKey = undefined;
        if (typeof arg1 === 'function') {
            this._fn = arg1;
            this._computeKey = identity;
        }
        else {
            this._fn = arg2;
            this._computeKey = arg1.getCacheKey;
        }
    }
    get(arg) {
        const key = this._computeKey(arg);
        if (this.lastArgKey !== key) {
            this.lastArgKey = key;
            this.lastCache = this._fn(arg);
        }
        return this.lastCache;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class Lazy {
    constructor(executor) {
        this.executor = executor;
        this._didRun = false;
    }
    /**
     * Get the wrapped value.
     *
     * This will force evaluation of the lazy value if it has not been resolved yet. Lazy values are only
     * resolved once. `getValue` will re-throw exceptions that are hit while resolving the value
     */
    get value() {
        if (!this._didRun) {
            try {
                this._value = this.executor();
            }
            catch (err) {
                this._error = err;
            }
            finally {
                this._didRun = true;
            }
        }
        if (this._error) {
            throw this._error;
        }
        return this._value;
    }
    /**
     * Get the wrapped value without forcing evaluation.
     */
    get rawValue() { return this._value; }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var _a;
/**
 * Escapes regular expression characters in a given string
 */
function escapeRegExpCharacters(value) {
    return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, '\\$&');
}
function splitLines(str) {
    return str.split(/\r\n|\r|\n/);
}
/**
 * Returns first index of the string that is not whitespace.
 * If string is empty or contains only whitespaces, returns -1
 */
function firstNonWhitespaceIndex(str) {
    for (let i = 0, len = str.length; i < len; i++) {
        const chCode = str.charCodeAt(i);
        if (chCode !== 32 /* CharCode.Space */ && chCode !== 9 /* CharCode.Tab */) {
            return i;
        }
    }
    return -1;
}
/**
 * Returns last index of the string that is not whitespace.
 * If string is empty or contains only whitespaces, returns -1
 */
function lastNonWhitespaceIndex(str, startIndex = str.length - 1) {
    for (let i = startIndex; i >= 0; i--) {
        const chCode = str.charCodeAt(i);
        if (chCode !== 32 /* CharCode.Space */ && chCode !== 9 /* CharCode.Tab */) {
            return i;
        }
    }
    return -1;
}
function isUpperAsciiLetter(code) {
    return code >= 65 /* CharCode.A */ && code <= 90 /* CharCode.Z */;
}
/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
function isHighSurrogate(charCode) {
    return (0xD800 <= charCode && charCode <= 0xDBFF);
}
/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
function isLowSurrogate(charCode) {
    return (0xDC00 <= charCode && charCode <= 0xDFFF);
}
/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
function computeCodePoint(highSurrogate, lowSurrogate) {
    return ((highSurrogate - 0xD800) << 10) + (lowSurrogate - 0xDC00) + 0x10000;
}
/**
 * get the code point that begins at offset `offset`
 */
function getNextCodePoint(str, len, offset) {
    const charCode = str.charCodeAt(offset);
    if (isHighSurrogate(charCode) && offset + 1 < len) {
        const nextCharCode = str.charCodeAt(offset + 1);
        if (isLowSurrogate(nextCharCode)) {
            return computeCodePoint(charCode, nextCharCode);
        }
    }
    return charCode;
}
const IS_BASIC_ASCII = /^[\t\n\r\x20-\x7E]*$/;
/**
 * Returns true if `str` contains only basic ASCII characters in the range 32 - 126 (including 32 and 126) or \n, \r, \t
 */
function isBasicASCII(str) {
    return IS_BASIC_ASCII.test(str);
}
class AmbiguousCharacters {
    static getInstance(locales) {
        return _a.cache.get(Array.from(locales));
    }
    static getLocales() {
        return _a._locales.value;
    }
    constructor(confusableDictionary) {
        this.confusableDictionary = confusableDictionary;
    }
    isAmbiguous(codePoint) {
        return this.confusableDictionary.has(codePoint);
    }
    /**
     * Returns the non basic ASCII code point that the given code point can be confused,
     * or undefined if such code point does note exist.
     */
    getPrimaryConfusable(codePoint) {
        return this.confusableDictionary.get(codePoint);
    }
    getConfusableCodePoints() {
        return new Set(this.confusableDictionary.keys());
    }
}
_a = AmbiguousCharacters;
AmbiguousCharacters.ambiguousCharacterData = new Lazy(() => {
    // Generated using https://github.com/hediet/vscode-unicode-data
    // Stored as key1, value1, key2, value2, ...
    return JSON.parse('{\"_common\":[8232,32,8233,32,5760,32,8192,32,8193,32,8194,32,8195,32,8196,32,8197,32,8198,32,8200,32,8201,32,8202,32,8287,32,8199,32,8239,32,2042,95,65101,95,65102,95,65103,95,8208,45,8209,45,8210,45,65112,45,1748,45,8259,45,727,45,8722,45,10134,45,11450,45,1549,44,1643,44,8218,44,184,44,42233,44,894,59,2307,58,2691,58,1417,58,1795,58,1796,58,5868,58,65072,58,6147,58,6153,58,8282,58,1475,58,760,58,42889,58,8758,58,720,58,42237,58,451,33,11601,33,660,63,577,63,2429,63,5038,63,42731,63,119149,46,8228,46,1793,46,1794,46,42510,46,68176,46,1632,46,1776,46,42232,46,1373,96,65287,96,8219,96,8242,96,1370,96,1523,96,8175,96,65344,96,900,96,8189,96,8125,96,8127,96,8190,96,697,96,884,96,712,96,714,96,715,96,756,96,699,96,701,96,700,96,702,96,42892,96,1497,96,2036,96,2037,96,5194,96,5836,96,94033,96,94034,96,65339,91,10088,40,10098,40,12308,40,64830,40,65341,93,10089,41,10099,41,12309,41,64831,41,10100,123,119060,123,10101,125,65342,94,8270,42,1645,42,8727,42,66335,42,5941,47,8257,47,8725,47,8260,47,9585,47,10187,47,10744,47,119354,47,12755,47,12339,47,11462,47,20031,47,12035,47,65340,92,65128,92,8726,92,10189,92,10741,92,10745,92,119311,92,119355,92,12756,92,20022,92,12034,92,42872,38,708,94,710,94,5869,43,10133,43,66203,43,8249,60,10094,60,706,60,119350,60,5176,60,5810,60,5120,61,11840,61,12448,61,42239,61,8250,62,10095,62,707,62,119351,62,5171,62,94015,62,8275,126,732,126,8128,126,8764,126,65372,124,65293,45,120784,50,120794,50,120804,50,120814,50,120824,50,130034,50,42842,50,423,50,1000,50,42564,50,5311,50,42735,50,119302,51,120785,51,120795,51,120805,51,120815,51,120825,51,130035,51,42923,51,540,51,439,51,42858,51,11468,51,1248,51,94011,51,71882,51,120786,52,120796,52,120806,52,120816,52,120826,52,130036,52,5070,52,71855,52,120787,53,120797,53,120807,53,120817,53,120827,53,130037,53,444,53,71867,53,120788,54,120798,54,120808,54,120818,54,120828,54,130038,54,11474,54,5102,54,71893,54,119314,55,120789,55,120799,55,120809,55,120819,55,120829,55,130039,55,66770,55,71878,55,2819,56,2538,56,2666,56,125131,56,120790,56,120800,56,120810,56,120820,56,120830,56,130040,56,547,56,546,56,66330,56,2663,57,2920,57,2541,57,3437,57,120791,57,120801,57,120811,57,120821,57,120831,57,130041,57,42862,57,11466,57,71884,57,71852,57,71894,57,9082,97,65345,97,119834,97,119886,97,119938,97,119990,97,120042,97,120094,97,120146,97,120198,97,120250,97,120302,97,120354,97,120406,97,120458,97,593,97,945,97,120514,97,120572,97,120630,97,120688,97,120746,97,65313,65,119808,65,119860,65,119912,65,119964,65,120016,65,120068,65,120120,65,120172,65,120224,65,120276,65,120328,65,120380,65,120432,65,913,65,120488,65,120546,65,120604,65,120662,65,120720,65,5034,65,5573,65,42222,65,94016,65,66208,65,119835,98,119887,98,119939,98,119991,98,120043,98,120095,98,120147,98,120199,98,120251,98,120303,98,120355,98,120407,98,120459,98,388,98,5071,98,5234,98,5551,98,65314,66,8492,66,119809,66,119861,66,119913,66,120017,66,120069,66,120121,66,120173,66,120225,66,120277,66,120329,66,120381,66,120433,66,42932,66,914,66,120489,66,120547,66,120605,66,120663,66,120721,66,5108,66,5623,66,42192,66,66178,66,66209,66,66305,66,65347,99,8573,99,119836,99,119888,99,119940,99,119992,99,120044,99,120096,99,120148,99,120200,99,120252,99,120304,99,120356,99,120408,99,120460,99,7428,99,1010,99,11429,99,43951,99,66621,99,128844,67,71922,67,71913,67,65315,67,8557,67,8450,67,8493,67,119810,67,119862,67,119914,67,119966,67,120018,67,120174,67,120226,67,120278,67,120330,67,120382,67,120434,67,1017,67,11428,67,5087,67,42202,67,66210,67,66306,67,66581,67,66844,67,8574,100,8518,100,119837,100,119889,100,119941,100,119993,100,120045,100,120097,100,120149,100,120201,100,120253,100,120305,100,120357,100,120409,100,120461,100,1281,100,5095,100,5231,100,42194,100,8558,68,8517,68,119811,68,119863,68,119915,68,119967,68,120019,68,120071,68,120123,68,120175,68,120227,68,120279,68,120331,68,120383,68,120435,68,5024,68,5598,68,5610,68,42195,68,8494,101,65349,101,8495,101,8519,101,119838,101,119890,101,119942,101,120046,101,120098,101,120150,101,120202,101,120254,101,120306,101,120358,101,120410,101,120462,101,43826,101,1213,101,8959,69,65317,69,8496,69,119812,69,119864,69,119916,69,120020,69,120072,69,120124,69,120176,69,120228,69,120280,69,120332,69,120384,69,120436,69,917,69,120492,69,120550,69,120608,69,120666,69,120724,69,11577,69,5036,69,42224,69,71846,69,71854,69,66182,69,119839,102,119891,102,119943,102,119995,102,120047,102,120099,102,120151,102,120203,102,120255,102,120307,102,120359,102,120411,102,120463,102,43829,102,42905,102,383,102,7837,102,1412,102,119315,70,8497,70,119813,70,119865,70,119917,70,120021,70,120073,70,120125,70,120177,70,120229,70,120281,70,120333,70,120385,70,120437,70,42904,70,988,70,120778,70,5556,70,42205,70,71874,70,71842,70,66183,70,66213,70,66853,70,65351,103,8458,103,119840,103,119892,103,119944,103,120048,103,120100,103,120152,103,120204,103,120256,103,120308,103,120360,103,120412,103,120464,103,609,103,7555,103,397,103,1409,103,119814,71,119866,71,119918,71,119970,71,120022,71,120074,71,120126,71,120178,71,120230,71,120282,71,120334,71,120386,71,120438,71,1292,71,5056,71,5107,71,42198,71,65352,104,8462,104,119841,104,119945,104,119997,104,120049,104,120101,104,120153,104,120205,104,120257,104,120309,104,120361,104,120413,104,120465,104,1211,104,1392,104,5058,104,65320,72,8459,72,8460,72,8461,72,119815,72,119867,72,119919,72,120023,72,120179,72,120231,72,120283,72,120335,72,120387,72,120439,72,919,72,120494,72,120552,72,120610,72,120668,72,120726,72,11406,72,5051,72,5500,72,42215,72,66255,72,731,105,9075,105,65353,105,8560,105,8505,105,8520,105,119842,105,119894,105,119946,105,119998,105,120050,105,120102,105,120154,105,120206,105,120258,105,120310,105,120362,105,120414,105,120466,105,120484,105,618,105,617,105,953,105,8126,105,890,105,120522,105,120580,105,120638,105,120696,105,120754,105,1110,105,42567,105,1231,105,43893,105,5029,105,71875,105,65354,106,8521,106,119843,106,119895,106,119947,106,119999,106,120051,106,120103,106,120155,106,120207,106,120259,106,120311,106,120363,106,120415,106,120467,106,1011,106,1112,106,65322,74,119817,74,119869,74,119921,74,119973,74,120025,74,120077,74,120129,74,120181,74,120233,74,120285,74,120337,74,120389,74,120441,74,42930,74,895,74,1032,74,5035,74,5261,74,42201,74,119844,107,119896,107,119948,107,120000,107,120052,107,120104,107,120156,107,120208,107,120260,107,120312,107,120364,107,120416,107,120468,107,8490,75,65323,75,119818,75,119870,75,119922,75,119974,75,120026,75,120078,75,120130,75,120182,75,120234,75,120286,75,120338,75,120390,75,120442,75,922,75,120497,75,120555,75,120613,75,120671,75,120729,75,11412,75,5094,75,5845,75,42199,75,66840,75,1472,108,8739,73,9213,73,65512,73,1633,108,1777,73,66336,108,125127,108,120783,73,120793,73,120803,73,120813,73,120823,73,130033,73,65321,73,8544,73,8464,73,8465,73,119816,73,119868,73,119920,73,120024,73,120128,73,120180,73,120232,73,120284,73,120336,73,120388,73,120440,73,65356,108,8572,73,8467,108,119845,108,119897,108,119949,108,120001,108,120053,108,120105,73,120157,73,120209,73,120261,73,120313,73,120365,73,120417,73,120469,73,448,73,120496,73,120554,73,120612,73,120670,73,120728,73,11410,73,1030,73,1216,73,1493,108,1503,108,1575,108,126464,108,126592,108,65166,108,65165,108,1994,108,11599,73,5825,73,42226,73,93992,73,66186,124,66313,124,119338,76,8556,76,8466,76,119819,76,119871,76,119923,76,120027,76,120079,76,120131,76,120183,76,120235,76,120287,76,120339,76,120391,76,120443,76,11472,76,5086,76,5290,76,42209,76,93974,76,71843,76,71858,76,66587,76,66854,76,65325,77,8559,77,8499,77,119820,77,119872,77,119924,77,120028,77,120080,77,120132,77,120184,77,120236,77,120288,77,120340,77,120392,77,120444,77,924,77,120499,77,120557,77,120615,77,120673,77,120731,77,1018,77,11416,77,5047,77,5616,77,5846,77,42207,77,66224,77,66321,77,119847,110,119899,110,119951,110,120003,110,120055,110,120107,110,120159,110,120211,110,120263,110,120315,110,120367,110,120419,110,120471,110,1400,110,1404,110,65326,78,8469,78,119821,78,119873,78,119925,78,119977,78,120029,78,120081,78,120185,78,120237,78,120289,78,120341,78,120393,78,120445,78,925,78,120500,78,120558,78,120616,78,120674,78,120732,78,11418,78,42208,78,66835,78,3074,111,3202,111,3330,111,3458,111,2406,111,2662,111,2790,111,3046,111,3174,111,3302,111,3430,111,3664,111,3792,111,4160,111,1637,111,1781,111,65359,111,8500,111,119848,111,119900,111,119952,111,120056,111,120108,111,120160,111,120212,111,120264,111,120316,111,120368,111,120420,111,120472,111,7439,111,7441,111,43837,111,959,111,120528,111,120586,111,120644,111,120702,111,120760,111,963,111,120532,111,120590,111,120648,111,120706,111,120764,111,11423,111,4351,111,1413,111,1505,111,1607,111,126500,111,126564,111,126596,111,65259,111,65260,111,65258,111,65257,111,1726,111,64428,111,64429,111,64427,111,64426,111,1729,111,64424,111,64425,111,64423,111,64422,111,1749,111,3360,111,4125,111,66794,111,71880,111,71895,111,66604,111,1984,79,2534,79,2918,79,12295,79,70864,79,71904,79,120782,79,120792,79,120802,79,120812,79,120822,79,130032,79,65327,79,119822,79,119874,79,119926,79,119978,79,120030,79,120082,79,120134,79,120186,79,120238,79,120290,79,120342,79,120394,79,120446,79,927,79,120502,79,120560,79,120618,79,120676,79,120734,79,11422,79,1365,79,11604,79,4816,79,2848,79,66754,79,42227,79,71861,79,66194,79,66219,79,66564,79,66838,79,9076,112,65360,112,119849,112,119901,112,119953,112,120005,112,120057,112,120109,112,120161,112,120213,112,120265,112,120317,112,120369,112,120421,112,120473,112,961,112,120530,112,120544,112,120588,112,120602,112,120646,112,120660,112,120704,112,120718,112,120762,112,120776,112,11427,112,65328,80,8473,80,119823,80,119875,80,119927,80,119979,80,120031,80,120083,80,120187,80,120239,80,120291,80,120343,80,120395,80,120447,80,929,80,120504,80,120562,80,120620,80,120678,80,120736,80,11426,80,5090,80,5229,80,42193,80,66197,80,119850,113,119902,113,119954,113,120006,113,120058,113,120110,113,120162,113,120214,113,120266,113,120318,113,120370,113,120422,113,120474,113,1307,113,1379,113,1382,113,8474,81,119824,81,119876,81,119928,81,119980,81,120032,81,120084,81,120188,81,120240,81,120292,81,120344,81,120396,81,120448,81,11605,81,119851,114,119903,114,119955,114,120007,114,120059,114,120111,114,120163,114,120215,114,120267,114,120319,114,120371,114,120423,114,120475,114,43847,114,43848,114,7462,114,11397,114,43905,114,119318,82,8475,82,8476,82,8477,82,119825,82,119877,82,119929,82,120033,82,120189,82,120241,82,120293,82,120345,82,120397,82,120449,82,422,82,5025,82,5074,82,66740,82,5511,82,42211,82,94005,82,65363,115,119852,115,119904,115,119956,115,120008,115,120060,115,120112,115,120164,115,120216,115,120268,115,120320,115,120372,115,120424,115,120476,115,42801,115,445,115,1109,115,43946,115,71873,115,66632,115,65331,83,119826,83,119878,83,119930,83,119982,83,120034,83,120086,83,120138,83,120190,83,120242,83,120294,83,120346,83,120398,83,120450,83,1029,83,1359,83,5077,83,5082,83,42210,83,94010,83,66198,83,66592,83,119853,116,119905,116,119957,116,120009,116,120061,116,120113,116,120165,116,120217,116,120269,116,120321,116,120373,116,120425,116,120477,116,8868,84,10201,84,128872,84,65332,84,119827,84,119879,84,119931,84,119983,84,120035,84,120087,84,120139,84,120191,84,120243,84,120295,84,120347,84,120399,84,120451,84,932,84,120507,84,120565,84,120623,84,120681,84,120739,84,11430,84,5026,84,42196,84,93962,84,71868,84,66199,84,66225,84,66325,84,119854,117,119906,117,119958,117,120010,117,120062,117,120114,117,120166,117,120218,117,120270,117,120322,117,120374,117,120426,117,120478,117,42911,117,7452,117,43854,117,43858,117,651,117,965,117,120534,117,120592,117,120650,117,120708,117,120766,117,1405,117,66806,117,71896,117,8746,85,8899,85,119828,85,119880,85,119932,85,119984,85,120036,85,120088,85,120140,85,120192,85,120244,85,120296,85,120348,85,120400,85,120452,85,1357,85,4608,85,66766,85,5196,85,42228,85,94018,85,71864,85,8744,118,8897,118,65366,118,8564,118,119855,118,119907,118,119959,118,120011,118,120063,118,120115,118,120167,118,120219,118,120271,118,120323,118,120375,118,120427,118,120479,118,7456,118,957,118,120526,118,120584,118,120642,118,120700,118,120758,118,1141,118,1496,118,71430,118,43945,118,71872,118,119309,86,1639,86,1783,86,8548,86,119829,86,119881,86,119933,86,119985,86,120037,86,120089,86,120141,86,120193,86,120245,86,120297,86,120349,86,120401,86,120453,86,1140,86,11576,86,5081,86,5167,86,42719,86,42214,86,93960,86,71840,86,66845,86,623,119,119856,119,119908,119,119960,119,120012,119,120064,119,120116,119,120168,119,120220,119,120272,119,120324,119,120376,119,120428,119,120480,119,7457,119,1121,119,1309,119,1377,119,71434,119,71438,119,71439,119,43907,119,71919,87,71910,87,119830,87,119882,87,119934,87,119986,87,120038,87,120090,87,120142,87,120194,87,120246,87,120298,87,120350,87,120402,87,120454,87,1308,87,5043,87,5076,87,42218,87,5742,120,10539,120,10540,120,10799,120,65368,120,8569,120,119857,120,119909,120,119961,120,120013,120,120065,120,120117,120,120169,120,120221,120,120273,120,120325,120,120377,120,120429,120,120481,120,5441,120,5501,120,5741,88,9587,88,66338,88,71916,88,65336,88,8553,88,119831,88,119883,88,119935,88,119987,88,120039,88,120091,88,120143,88,120195,88,120247,88,120299,88,120351,88,120403,88,120455,88,42931,88,935,88,120510,88,120568,88,120626,88,120684,88,120742,88,11436,88,11613,88,5815,88,42219,88,66192,88,66228,88,66327,88,66855,88,611,121,7564,121,65369,121,119858,121,119910,121,119962,121,120014,121,120066,121,120118,121,120170,121,120222,121,120274,121,120326,121,120378,121,120430,121,120482,121,655,121,7935,121,43866,121,947,121,8509,121,120516,121,120574,121,120632,121,120690,121,120748,121,1199,121,4327,121,71900,121,65337,89,119832,89,119884,89,119936,89,119988,89,120040,89,120092,89,120144,89,120196,89,120248,89,120300,89,120352,89,120404,89,120456,89,933,89,978,89,120508,89,120566,89,120624,89,120682,89,120740,89,11432,89,1198,89,5033,89,5053,89,42220,89,94019,89,71844,89,66226,89,119859,122,119911,122,119963,122,120015,122,120067,122,120119,122,120171,122,120223,122,120275,122,120327,122,120379,122,120431,122,120483,122,7458,122,43923,122,71876,122,66293,90,71909,90,65338,90,8484,90,8488,90,119833,90,119885,90,119937,90,119989,90,120041,90,120197,90,120249,90,120301,90,120353,90,120405,90,120457,90,918,90,120493,90,120551,90,120609,90,120667,90,120725,90,5059,90,42204,90,71849,90,65282,34,65284,36,65285,37,65286,38,65290,42,65291,43,65294,46,65295,47,65296,48,65297,49,65298,50,65299,51,65300,52,65301,53,65302,54,65303,55,65304,56,65305,57,65308,60,65309,61,65310,62,65312,64,65316,68,65318,70,65319,71,65324,76,65329,81,65330,82,65333,85,65334,86,65335,87,65343,95,65346,98,65348,100,65350,102,65355,107,65357,109,65358,110,65361,113,65362,114,65364,116,65365,117,65367,119,65370,122,65371,123,65373,125,119846,109],\"_default\":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"cs\":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"de\":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"es\":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"fr\":[65374,126,65306,58,65281,33,8216,96,8245,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"it\":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"ja\":[8211,45,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65292,44,65307,59],\"ko\":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"pl\":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"pt-BR\":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"qps-ploc\":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"ru\":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,305,105,921,73,1009,112,215,120,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"tr\":[160,32,8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],\"zh-hans\":[65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41],\"zh-hant\":[8211,45,65374,126,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65307,59]}');
});
AmbiguousCharacters.cache = new LRUCachedFunction({ getCacheKey: JSON.stringify }, (locales) => {
    function arrayToMap(arr) {
        const result = new Map();
        for (let i = 0; i < arr.length; i += 2) {
            result.set(arr[i], arr[i + 1]);
        }
        return result;
    }
    function mergeMaps(map1, map2) {
        const result = new Map(map1);
        for (const [key, value] of map2) {
            result.set(key, value);
        }
        return result;
    }
    function intersectMaps(map1, map2) {
        if (!map1) {
            return map2;
        }
        const result = new Map();
        for (const [key, value] of map1) {
            if (map2.has(key)) {
                result.set(key, value);
            }
        }
        return result;
    }
    const data = _a.ambiguousCharacterData.value;
    let filteredLocales = locales.filter((l) => !l.startsWith('_') && l in data);
    if (filteredLocales.length === 0) {
        filteredLocales = ['_default'];
    }
    let languageSpecificMap = undefined;
    for (const locale of filteredLocales) {
        const map = arrayToMap(data[locale]);
        languageSpecificMap = intersectMaps(languageSpecificMap, map);
    }
    const commonMap = arrayToMap(data['_common']);
    const map = mergeMaps(commonMap, languageSpecificMap);
    return new _a(map);
});
AmbiguousCharacters._locales = new Lazy(() => Object.keys(_a.ambiguousCharacterData.value).filter((k) => !k.startsWith('_')));
class InvisibleCharacters {
    static getRawData() {
        // Generated using https://github.com/hediet/vscode-unicode-data
        return JSON.parse('[9,10,11,12,13,32,127,160,173,847,1564,4447,4448,6068,6069,6155,6156,6157,6158,7355,7356,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8203,8204,8205,8206,8207,8234,8235,8236,8237,8238,8239,8287,8288,8289,8290,8291,8292,8293,8294,8295,8296,8297,8298,8299,8300,8301,8302,8303,10240,12288,12644,65024,65025,65026,65027,65028,65029,65030,65031,65032,65033,65034,65035,65036,65037,65038,65039,65279,65440,65520,65521,65522,65523,65524,65525,65526,65527,65528,65532,78844,119155,119156,119157,119158,119159,119160,119161,119162,917504,917505,917506,917507,917508,917509,917510,917511,917512,917513,917514,917515,917516,917517,917518,917519,917520,917521,917522,917523,917524,917525,917526,917527,917528,917529,917530,917531,917532,917533,917534,917535,917536,917537,917538,917539,917540,917541,917542,917543,917544,917545,917546,917547,917548,917549,917550,917551,917552,917553,917554,917555,917556,917557,917558,917559,917560,917561,917562,917563,917564,917565,917566,917567,917568,917569,917570,917571,917572,917573,917574,917575,917576,917577,917578,917579,917580,917581,917582,917583,917584,917585,917586,917587,917588,917589,917590,917591,917592,917593,917594,917595,917596,917597,917598,917599,917600,917601,917602,917603,917604,917605,917606,917607,917608,917609,917610,917611,917612,917613,917614,917615,917616,917617,917618,917619,917620,917621,917622,917623,917624,917625,917626,917627,917628,917629,917630,917631,917760,917761,917762,917763,917764,917765,917766,917767,917768,917769,917770,917771,917772,917773,917774,917775,917776,917777,917778,917779,917780,917781,917782,917783,917784,917785,917786,917787,917788,917789,917790,917791,917792,917793,917794,917795,917796,917797,917798,917799,917800,917801,917802,917803,917804,917805,917806,917807,917808,917809,917810,917811,917812,917813,917814,917815,917816,917817,917818,917819,917820,917821,917822,917823,917824,917825,917826,917827,917828,917829,917830,917831,917832,917833,917834,917835,917836,917837,917838,917839,917840,917841,917842,917843,917844,917845,917846,917847,917848,917849,917850,917851,917852,917853,917854,917855,917856,917857,917858,917859,917860,917861,917862,917863,917864,917865,917866,917867,917868,917869,917870,917871,917872,917873,917874,917875,917876,917877,917878,917879,917880,917881,917882,917883,917884,917885,917886,917887,917888,917889,917890,917891,917892,917893,917894,917895,917896,917897,917898,917899,917900,917901,917902,917903,917904,917905,917906,917907,917908,917909,917910,917911,917912,917913,917914,917915,917916,917917,917918,917919,917920,917921,917922,917923,917924,917925,917926,917927,917928,917929,917930,917931,917932,917933,917934,917935,917936,917937,917938,917939,917940,917941,917942,917943,917944,917945,917946,917947,917948,917949,917950,917951,917952,917953,917954,917955,917956,917957,917958,917959,917960,917961,917962,917963,917964,917965,917966,917967,917968,917969,917970,917971,917972,917973,917974,917975,917976,917977,917978,917979,917980,917981,917982,917983,917984,917985,917986,917987,917988,917989,917990,917991,917992,917993,917994,917995,917996,917997,917998,917999]');
    }
    static getData() {
        if (!this._data) {
            this._data = new Set(InvisibleCharacters.getRawData());
        }
        return this._data;
    }
    static isInvisibleCharacter(codePoint) {
        return InvisibleCharacters.getData().has(codePoint);
    }
    static get codePoints() {
        return InvisibleCharacters.getData();
    }
}
InvisibleCharacters._data = undefined;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const INITIALIZE = '$initialize';
class RequestMessage {
    constructor(vsWorker, req, method, args) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.method = method;
        this.args = args;
        this.type = 0 /* MessageType.Request */;
    }
}
class ReplyMessage {
    constructor(vsWorker, seq, res, err) {
        this.vsWorker = vsWorker;
        this.seq = seq;
        this.res = res;
        this.err = err;
        this.type = 1 /* MessageType.Reply */;
    }
}
class SubscribeEventMessage {
    constructor(vsWorker, req, eventName, arg) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.eventName = eventName;
        this.arg = arg;
        this.type = 2 /* MessageType.SubscribeEvent */;
    }
}
class EventMessage {
    constructor(vsWorker, req, event) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.event = event;
        this.type = 3 /* MessageType.Event */;
    }
}
class UnsubscribeEventMessage {
    constructor(vsWorker, req) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.type = 4 /* MessageType.UnsubscribeEvent */;
    }
}
class SimpleWorkerProtocol {
    constructor(handler) {
        this._workerId = -1;
        this._handler = handler;
        this._lastSentReq = 0;
        this._pendingReplies = Object.create(null);
        this._pendingEmitters = new Map();
        this._pendingEvents = new Map();
    }
    setWorkerId(workerId) {
        this._workerId = workerId;
    }
    sendMessage(method, args) {
        const req = String(++this._lastSentReq);
        return new Promise((resolve, reject) => {
            this._pendingReplies[req] = {
                resolve: resolve,
                reject: reject
            };
            this._send(new RequestMessage(this._workerId, req, method, args));
        });
    }
    listen(eventName, arg) {
        let req = null;
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                req = String(++this._lastSentReq);
                this._pendingEmitters.set(req, emitter);
                this._send(new SubscribeEventMessage(this._workerId, req, eventName, arg));
            },
            onDidRemoveLastListener: () => {
                this._pendingEmitters.delete(req);
                this._send(new UnsubscribeEventMessage(this._workerId, req));
                req = null;
            }
        });
        return emitter.event;
    }
    handleMessage(message) {
        if (!message || !message.vsWorker) {
            return;
        }
        if (this._workerId !== -1 && message.vsWorker !== this._workerId) {
            return;
        }
        this._handleMessage(message);
    }
    _handleMessage(msg) {
        switch (msg.type) {
            case 1 /* MessageType.Reply */:
                return this._handleReplyMessage(msg);
            case 0 /* MessageType.Request */:
                return this._handleRequestMessage(msg);
            case 2 /* MessageType.SubscribeEvent */:
                return this._handleSubscribeEventMessage(msg);
            case 3 /* MessageType.Event */:
                return this._handleEventMessage(msg);
            case 4 /* MessageType.UnsubscribeEvent */:
                return this._handleUnsubscribeEventMessage(msg);
        }
    }
    _handleReplyMessage(replyMessage) {
        if (!this._pendingReplies[replyMessage.seq]) {
            console.warn('Got reply to unknown seq');
            return;
        }
        const reply = this._pendingReplies[replyMessage.seq];
        delete this._pendingReplies[replyMessage.seq];
        if (replyMessage.err) {
            let err = replyMessage.err;
            if (replyMessage.err.$isError) {
                err = new Error();
                err.name = replyMessage.err.name;
                err.message = replyMessage.err.message;
                err.stack = replyMessage.err.stack;
            }
            reply.reject(err);
            return;
        }
        reply.resolve(replyMessage.res);
    }
    _handleRequestMessage(requestMessage) {
        const req = requestMessage.req;
        const result = this._handler.handleMessage(requestMessage.method, requestMessage.args);
        result.then((r) => {
            this._send(new ReplyMessage(this._workerId, req, r, undefined));
        }, (e) => {
            if (e.detail instanceof Error) {
                // Loading errors have a detail property that points to the actual error
                e.detail = transformErrorForSerialization(e.detail);
            }
            this._send(new ReplyMessage(this._workerId, req, undefined, transformErrorForSerialization(e)));
        });
    }
    _handleSubscribeEventMessage(msg) {
        const req = msg.req;
        const disposable = this._handler.handleEvent(msg.eventName, msg.arg)((event) => {
            this._send(new EventMessage(this._workerId, req, event));
        });
        this._pendingEvents.set(req, disposable);
    }
    _handleEventMessage(msg) {
        if (!this._pendingEmitters.has(msg.req)) {
            console.warn('Got event for unknown req');
            return;
        }
        this._pendingEmitters.get(msg.req).fire(msg.event);
    }
    _handleUnsubscribeEventMessage(msg) {
        if (!this._pendingEvents.has(msg.req)) {
            console.warn('Got unsubscribe for unknown req');
            return;
        }
        this._pendingEvents.get(msg.req).dispose();
        this._pendingEvents.delete(msg.req);
    }
    _send(msg) {
        const transfer = [];
        if (msg.type === 0 /* MessageType.Request */) {
            for (let i = 0; i < msg.args.length; i++) {
                if (msg.args[i] instanceof ArrayBuffer) {
                    transfer.push(msg.args[i]);
                }
            }
        }
        else if (msg.type === 1 /* MessageType.Reply */) {
            if (msg.res instanceof ArrayBuffer) {
                transfer.push(msg.res);
            }
        }
        this._handler.sendMessage(msg, transfer);
    }
}
function propertyIsEvent(name) {
    // Assume a property is an event if it has a form of "onSomething"
    return name[0] === 'o' && name[1] === 'n' && isUpperAsciiLetter(name.charCodeAt(2));
}
function propertyIsDynamicEvent(name) {
    // Assume a property is a dynamic event (a method that returns an event) if it has a form of "onDynamicSomething"
    return /^onDynamic/.test(name) && isUpperAsciiLetter(name.charCodeAt(9));
}
function createProxyObject(methodNames, invoke, proxyListen) {
    const createProxyMethod = (method) => {
        return function () {
            const args = Array.prototype.slice.call(arguments, 0);
            return invoke(method, args);
        };
    };
    const createProxyDynamicEvent = (eventName) => {
        return function (arg) {
            return proxyListen(eventName, arg);
        };
    };
    const result = {};
    for (const methodName of methodNames) {
        if (propertyIsDynamicEvent(methodName)) {
            result[methodName] = createProxyDynamicEvent(methodName);
            continue;
        }
        if (propertyIsEvent(methodName)) {
            result[methodName] = proxyListen(methodName, undefined);
            continue;
        }
        result[methodName] = createProxyMethod(methodName);
    }
    return result;
}
/**
 * Worker side
 */
class SimpleWorkerServer {
    constructor(postMessage, requestHandlerFactory) {
        this._requestHandlerFactory = requestHandlerFactory;
        this._requestHandler = null;
        this._protocol = new SimpleWorkerProtocol({
            sendMessage: (msg, transfer) => {
                postMessage(msg, transfer);
            },
            handleMessage: (method, args) => this._handleMessage(method, args),
            handleEvent: (eventName, arg) => this._handleEvent(eventName, arg)
        });
    }
    onmessage(msg) {
        this._protocol.handleMessage(msg);
    }
    _handleMessage(method, args) {
        if (method === INITIALIZE) {
            return this.initialize(args[0], args[1], args[2], args[3]);
        }
        if (!this._requestHandler || typeof this._requestHandler[method] !== 'function') {
            return Promise.reject(new Error('Missing requestHandler or method: ' + method));
        }
        try {
            return Promise.resolve(this._requestHandler[method].apply(this._requestHandler, args));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    _handleEvent(eventName, arg) {
        if (!this._requestHandler) {
            throw new Error(`Missing requestHandler`);
        }
        if (propertyIsDynamicEvent(eventName)) {
            const event = this._requestHandler[eventName].call(this._requestHandler, arg);
            if (typeof event !== 'function') {
                throw new Error(`Missing dynamic event ${eventName} on request handler.`);
            }
            return event;
        }
        if (propertyIsEvent(eventName)) {
            const event = this._requestHandler[eventName];
            if (typeof event !== 'function') {
                throw new Error(`Missing event ${eventName} on request handler.`);
            }
            return event;
        }
        throw new Error(`Malformed event name ${eventName}`);
    }
    initialize(workerId, loaderConfig, moduleId, hostMethods) {
        this._protocol.setWorkerId(workerId);
        const proxyMethodRequest = (method, args) => {
            return this._protocol.sendMessage(method, args);
        };
        const proxyListen = (eventName, arg) => {
            return this._protocol.listen(eventName, arg);
        };
        const hostProxy = createProxyObject(hostMethods, proxyMethodRequest, proxyListen);
        if (this._requestHandlerFactory) {
            // static request handler
            this._requestHandler = this._requestHandlerFactory(hostProxy);
            return Promise.resolve(getAllMethodNames(this._requestHandler));
        }
        if (loaderConfig) {
            // Remove 'baseUrl', handling it is beyond scope for now
            if (typeof loaderConfig.baseUrl !== 'undefined') {
                delete loaderConfig['baseUrl'];
            }
            if (typeof loaderConfig.paths !== 'undefined') {
                if (typeof loaderConfig.paths.vs !== 'undefined') {
                    delete loaderConfig.paths['vs'];
                }
            }
            if (typeof loaderConfig.trustedTypesPolicy !== 'undefined') {
                // don't use, it has been destroyed during serialize
                delete loaderConfig['trustedTypesPolicy'];
            }
            // Since this is in a web worker, enable catching errors
            loaderConfig.catchError = true;
            globalThis.require.config(loaderConfig);
        }
        return new Promise((resolve, reject) => {
            // Use the global require to be sure to get the global config
            // ESM-comment-begin
            // 			const req = (globalThis.require || require);
            // ESM-comment-end
            // ESM-uncomment-begin
            const req = globalThis.require;
            // ESM-uncomment-end
            req([moduleId], (module) => {
                this._requestHandler = module.create(hostProxy);
                if (!this._requestHandler) {
                    reject(new Error(`No RequestHandler!`));
                    return;
                }
                resolve(getAllMethodNames(this._requestHandler));
            }, reject);
        });
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Represents information about a specific difference between two sequences.
 */
class DiffChange {
    /**
     * Constructs a new DiffChange with the given sequence information
     * and content.
     */
    constructor(originalStart, originalLength, modifiedStart, modifiedLength) {
        //Debug.Assert(originalLength > 0 || modifiedLength > 0, "originalLength and modifiedLength cannot both be <= 0");
        this.originalStart = originalStart;
        this.originalLength = originalLength;
        this.modifiedStart = modifiedStart;
        this.modifiedLength = modifiedLength;
    }
    /**
     * The end point (exclusive) of the change in the original sequence.
     */
    getOriginalEnd() {
        return this.originalStart + this.originalLength;
    }
    /**
     * The end point (exclusive) of the change in the modified sequence.
     */
    getModifiedEnd() {
        return this.modifiedStart + this.modifiedLength;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function numberHash(val, initialHashVal) {
    return (((initialHashVal << 5) - initialHashVal) + val) | 0; // hashVal * 31 + ch, keep as int32
}
function stringHash(s, hashVal) {
    hashVal = numberHash(149417, hashVal);
    for (let i = 0, length = s.length; i < length; i++) {
        hashVal = numberHash(s.charCodeAt(i), hashVal);
    }
    return hashVal;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class StringDiffSequence {
    constructor(source) {
        this.source = source;
    }
    getElements() {
        const source = this.source;
        const characters = new Int32Array(source.length);
        for (let i = 0, len = source.length; i < len; i++) {
            characters[i] = source.charCodeAt(i);
        }
        return characters;
    }
}
function stringDiff(original, modified, pretty) {
    return new LcsDiff(new StringDiffSequence(original), new StringDiffSequence(modified)).ComputeDiff(pretty).changes;
}
//
// The code below has been ported from a C# implementation in VS
//
class Debug {
    static Assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
}
class MyArray {
    /**
     * Copies a range of elements from an Array starting at the specified source index and pastes
     * them to another Array starting at the specified destination index. The length and the indexes
     * are specified as 64-bit integers.
     * sourceArray:
     *		The Array that contains the data to copy.
     * sourceIndex:
     *		A 64-bit integer that represents the index in the sourceArray at which copying begins.
     * destinationArray:
     *		The Array that receives the data.
     * destinationIndex:
     *		A 64-bit integer that represents the index in the destinationArray at which storing begins.
     * length:
     *		A 64-bit integer that represents the number of elements to copy.
     */
    static Copy(sourceArray, sourceIndex, destinationArray, destinationIndex, length) {
        for (let i = 0; i < length; i++) {
            destinationArray[destinationIndex + i] = sourceArray[sourceIndex + i];
        }
    }
    static Copy2(sourceArray, sourceIndex, destinationArray, destinationIndex, length) {
        for (let i = 0; i < length; i++) {
            destinationArray[destinationIndex + i] = sourceArray[sourceIndex + i];
        }
    }
}
/**
 * A utility class which helps to create the set of DiffChanges from
 * a difference operation. This class accepts original DiffElements and
 * modified DiffElements that are involved in a particular change. The
 * MarkNextChange() method can be called to mark the separation between
 * distinct changes. At the end, the Changes property can be called to retrieve
 * the constructed changes.
 */
class DiffChangeHelper {
    /**
     * Constructs a new DiffChangeHelper for the given DiffSequences.
     */
    constructor() {
        this.m_changes = [];
        this.m_originalStart = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
        this.m_modifiedStart = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
        this.m_originalCount = 0;
        this.m_modifiedCount = 0;
    }
    /**
     * Marks the beginning of the next change in the set of differences.
     */
    MarkNextChange() {
        // Only add to the list if there is something to add
        if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
            // Add the new change to our list
            this.m_changes.push(new DiffChange(this.m_originalStart, this.m_originalCount, this.m_modifiedStart, this.m_modifiedCount));
        }
        // Reset for the next change
        this.m_originalCount = 0;
        this.m_modifiedCount = 0;
        this.m_originalStart = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
        this.m_modifiedStart = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
    }
    /**
     * Adds the original element at the given position to the elements
     * affected by the current change. The modified index gives context
     * to the change position with respect to the original sequence.
     * @param originalIndex The index of the original element to add.
     * @param modifiedIndex The index of the modified element that provides corresponding position in the modified sequence.
     */
    AddOriginalElement(originalIndex, modifiedIndex) {
        // The 'true' start index is the smallest of the ones we've seen
        this.m_originalStart = Math.min(this.m_originalStart, originalIndex);
        this.m_modifiedStart = Math.min(this.m_modifiedStart, modifiedIndex);
        this.m_originalCount++;
    }
    /**
     * Adds the modified element at the given position to the elements
     * affected by the current change. The original index gives context
     * to the change position with respect to the modified sequence.
     * @param originalIndex The index of the original element that provides corresponding position in the original sequence.
     * @param modifiedIndex The index of the modified element to add.
     */
    AddModifiedElement(originalIndex, modifiedIndex) {
        // The 'true' start index is the smallest of the ones we've seen
        this.m_originalStart = Math.min(this.m_originalStart, originalIndex);
        this.m_modifiedStart = Math.min(this.m_modifiedStart, modifiedIndex);
        this.m_modifiedCount++;
    }
    /**
     * Retrieves all of the changes marked by the class.
     */
    getChanges() {
        if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
            // Finish up on whatever is left
            this.MarkNextChange();
        }
        return this.m_changes;
    }
    /**
     * Retrieves all of the changes marked by the class in the reverse order
     */
    getReverseChanges() {
        if (this.m_originalCount > 0 || this.m_modifiedCount > 0) {
            // Finish up on whatever is left
            this.MarkNextChange();
        }
        this.m_changes.reverse();
        return this.m_changes;
    }
}
/**
 * An implementation of the difference algorithm described in
 * "An O(ND) Difference Algorithm and its variations" by Eugene W. Myers
 */
class LcsDiff {
    /**
     * Constructs the DiffFinder
     */
    constructor(originalSequence, modifiedSequence, continueProcessingPredicate = null) {
        this.ContinueProcessingPredicate = continueProcessingPredicate;
        this._originalSequence = originalSequence;
        this._modifiedSequence = modifiedSequence;
        const [originalStringElements, originalElementsOrHash, originalHasStrings] = LcsDiff._getElements(originalSequence);
        const [modifiedStringElements, modifiedElementsOrHash, modifiedHasStrings] = LcsDiff._getElements(modifiedSequence);
        this._hasStrings = (originalHasStrings && modifiedHasStrings);
        this._originalStringElements = originalStringElements;
        this._originalElementsOrHash = originalElementsOrHash;
        this._modifiedStringElements = modifiedStringElements;
        this._modifiedElementsOrHash = modifiedElementsOrHash;
        this.m_forwardHistory = [];
        this.m_reverseHistory = [];
    }
    static _isStringArray(arr) {
        return (arr.length > 0 && typeof arr[0] === 'string');
    }
    static _getElements(sequence) {
        const elements = sequence.getElements();
        if (LcsDiff._isStringArray(elements)) {
            const hashes = new Int32Array(elements.length);
            for (let i = 0, len = elements.length; i < len; i++) {
                hashes[i] = stringHash(elements[i], 0);
            }
            return [elements, hashes, true];
        }
        if (elements instanceof Int32Array) {
            return [[], elements, false];
        }
        return [[], new Int32Array(elements), false];
    }
    ElementsAreEqual(originalIndex, newIndex) {
        if (this._originalElementsOrHash[originalIndex] !== this._modifiedElementsOrHash[newIndex]) {
            return false;
        }
        return (this._hasStrings ? this._originalStringElements[originalIndex] === this._modifiedStringElements[newIndex] : true);
    }
    ElementsAreStrictEqual(originalIndex, newIndex) {
        if (!this.ElementsAreEqual(originalIndex, newIndex)) {
            return false;
        }
        const originalElement = LcsDiff._getStrictElement(this._originalSequence, originalIndex);
        const modifiedElement = LcsDiff._getStrictElement(this._modifiedSequence, newIndex);
        return (originalElement === modifiedElement);
    }
    static _getStrictElement(sequence, index) {
        if (typeof sequence.getStrictElement === 'function') {
            return sequence.getStrictElement(index);
        }
        return null;
    }
    OriginalElementsAreEqual(index1, index2) {
        if (this._originalElementsOrHash[index1] !== this._originalElementsOrHash[index2]) {
            return false;
        }
        return (this._hasStrings ? this._originalStringElements[index1] === this._originalStringElements[index2] : true);
    }
    ModifiedElementsAreEqual(index1, index2) {
        if (this._modifiedElementsOrHash[index1] !== this._modifiedElementsOrHash[index2]) {
            return false;
        }
        return (this._hasStrings ? this._modifiedStringElements[index1] === this._modifiedStringElements[index2] : true);
    }
    ComputeDiff(pretty) {
        return this._ComputeDiff(0, this._originalElementsOrHash.length - 1, 0, this._modifiedElementsOrHash.length - 1, pretty);
    }
    /**
     * Computes the differences between the original and modified input
     * sequences on the bounded range.
     * @returns An array of the differences between the two input sequences.
     */
    _ComputeDiff(originalStart, originalEnd, modifiedStart, modifiedEnd, pretty) {
        const quitEarlyArr = [false];
        let changes = this.ComputeDiffRecursive(originalStart, originalEnd, modifiedStart, modifiedEnd, quitEarlyArr);
        if (pretty) {
            // We have to clean up the computed diff to be more intuitive
            // but it turns out this cannot be done correctly until the entire set
            // of diffs have been computed
            changes = this.PrettifyChanges(changes);
        }
        return {
            quitEarly: quitEarlyArr[0],
            changes: changes
        };
    }
    /**
     * Private helper method which computes the differences on the bounded range
     * recursively.
     * @returns An array of the differences between the two input sequences.
     */
    ComputeDiffRecursive(originalStart, originalEnd, modifiedStart, modifiedEnd, quitEarlyArr) {
        quitEarlyArr[0] = false;
        // Find the start of the differences
        while (originalStart <= originalEnd && modifiedStart <= modifiedEnd && this.ElementsAreEqual(originalStart, modifiedStart)) {
            originalStart++;
            modifiedStart++;
        }
        // Find the end of the differences
        while (originalEnd >= originalStart && modifiedEnd >= modifiedStart && this.ElementsAreEqual(originalEnd, modifiedEnd)) {
            originalEnd--;
            modifiedEnd--;
        }
        // In the special case where we either have all insertions or all deletions or the sequences are identical
        if (originalStart > originalEnd || modifiedStart > modifiedEnd) {
            let changes;
            if (modifiedStart <= modifiedEnd) {
                Debug.Assert(originalStart === originalEnd + 1, 'originalStart should only be one more than originalEnd');
                // All insertions
                changes = [
                    new DiffChange(originalStart, 0, modifiedStart, modifiedEnd - modifiedStart + 1)
                ];
            }
            else if (originalStart <= originalEnd) {
                Debug.Assert(modifiedStart === modifiedEnd + 1, 'modifiedStart should only be one more than modifiedEnd');
                // All deletions
                changes = [
                    new DiffChange(originalStart, originalEnd - originalStart + 1, modifiedStart, 0)
                ];
            }
            else {
                Debug.Assert(originalStart === originalEnd + 1, 'originalStart should only be one more than originalEnd');
                Debug.Assert(modifiedStart === modifiedEnd + 1, 'modifiedStart should only be one more than modifiedEnd');
                // Identical sequences - No differences
                changes = [];
            }
            return changes;
        }
        // This problem can be solved using the Divide-And-Conquer technique.
        const midOriginalArr = [0];
        const midModifiedArr = [0];
        const result = this.ComputeRecursionPoint(originalStart, originalEnd, modifiedStart, modifiedEnd, midOriginalArr, midModifiedArr, quitEarlyArr);
        const midOriginal = midOriginalArr[0];
        const midModified = midModifiedArr[0];
        if (result !== null) {
            // Result is not-null when there was enough memory to compute the changes while
            // searching for the recursion point
            return result;
        }
        else if (!quitEarlyArr[0]) {
            // We can break the problem down recursively by finding the changes in the
            // First Half:   (originalStart, modifiedStart) to (midOriginal, midModified)
            // Second Half:  (midOriginal + 1, minModified + 1) to (originalEnd, modifiedEnd)
            // NOTE: ComputeDiff() is inclusive, therefore the second range starts on the next point
            const leftChanges = this.ComputeDiffRecursive(originalStart, midOriginal, modifiedStart, midModified, quitEarlyArr);
            let rightChanges = [];
            if (!quitEarlyArr[0]) {
                rightChanges = this.ComputeDiffRecursive(midOriginal + 1, originalEnd, midModified + 1, modifiedEnd, quitEarlyArr);
            }
            else {
                // We didn't have time to finish the first half, so we don't have time to compute this half.
                // Consider the entire rest of the sequence different.
                rightChanges = [
                    new DiffChange(midOriginal + 1, originalEnd - (midOriginal + 1) + 1, midModified + 1, modifiedEnd - (midModified + 1) + 1)
                ];
            }
            return this.ConcatenateChanges(leftChanges, rightChanges);
        }
        // If we hit here, we quit early, and so can't return anything meaningful
        return [
            new DiffChange(originalStart, originalEnd - originalStart + 1, modifiedStart, modifiedEnd - modifiedStart + 1)
        ];
    }
    WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr) {
        let forwardChanges = null;
        let reverseChanges = null;
        // First, walk backward through the forward diagonals history
        let changeHelper = new DiffChangeHelper();
        let diagonalMin = diagonalForwardStart;
        let diagonalMax = diagonalForwardEnd;
        let diagonalRelative = (midOriginalArr[0] - midModifiedArr[0]) - diagonalForwardOffset;
        let lastOriginalIndex = -1073741824 /* Constants.MIN_SAFE_SMALL_INTEGER */;
        let historyIndex = this.m_forwardHistory.length - 1;
        do {
            // Get the diagonal index from the relative diagonal number
            const diagonal = diagonalRelative + diagonalForwardBase;
            // Figure out where we came from
            if (diagonal === diagonalMin || (diagonal < diagonalMax && forwardPoints[diagonal - 1] < forwardPoints[diagonal + 1])) {
                // Vertical line (the element is an insert)
                originalIndex = forwardPoints[diagonal + 1];
                modifiedIndex = originalIndex - diagonalRelative - diagonalForwardOffset;
                if (originalIndex < lastOriginalIndex) {
                    changeHelper.MarkNextChange();
                }
                lastOriginalIndex = originalIndex;
                changeHelper.AddModifiedElement(originalIndex + 1, modifiedIndex);
                diagonalRelative = (diagonal + 1) - diagonalForwardBase; //Setup for the next iteration
            }
            else {
                // Horizontal line (the element is a deletion)
                originalIndex = forwardPoints[diagonal - 1] + 1;
                modifiedIndex = originalIndex - diagonalRelative - diagonalForwardOffset;
                if (originalIndex < lastOriginalIndex) {
                    changeHelper.MarkNextChange();
                }
                lastOriginalIndex = originalIndex - 1;
                changeHelper.AddOriginalElement(originalIndex, modifiedIndex + 1);
                diagonalRelative = (diagonal - 1) - diagonalForwardBase; //Setup for the next iteration
            }
            if (historyIndex >= 0) {
                forwardPoints = this.m_forwardHistory[historyIndex];
                diagonalForwardBase = forwardPoints[0]; //We stored this in the first spot
                diagonalMin = 1;
                diagonalMax = forwardPoints.length - 1;
            }
        } while (--historyIndex >= -1);
        // Ironically, we get the forward changes as the reverse of the
        // order we added them since we technically added them backwards
        forwardChanges = changeHelper.getReverseChanges();
        if (quitEarlyArr[0]) {
            // TODO: Calculate a partial from the reverse diagonals.
            //       For now, just assume everything after the midOriginal/midModified point is a diff
            let originalStartPoint = midOriginalArr[0] + 1;
            let modifiedStartPoint = midModifiedArr[0] + 1;
            if (forwardChanges !== null && forwardChanges.length > 0) {
                const lastForwardChange = forwardChanges[forwardChanges.length - 1];
                originalStartPoint = Math.max(originalStartPoint, lastForwardChange.getOriginalEnd());
                modifiedStartPoint = Math.max(modifiedStartPoint, lastForwardChange.getModifiedEnd());
            }
            reverseChanges = [
                new DiffChange(originalStartPoint, originalEnd - originalStartPoint + 1, modifiedStartPoint, modifiedEnd - modifiedStartPoint + 1)
            ];
        }
        else {
            // Now walk backward through the reverse diagonals history
            changeHelper = new DiffChangeHelper();
            diagonalMin = diagonalReverseStart;
            diagonalMax = diagonalReverseEnd;
            diagonalRelative = (midOriginalArr[0] - midModifiedArr[0]) - diagonalReverseOffset;
            lastOriginalIndex = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
            historyIndex = (deltaIsEven) ? this.m_reverseHistory.length - 1 : this.m_reverseHistory.length - 2;
            do {
                // Get the diagonal index from the relative diagonal number
                const diagonal = diagonalRelative + diagonalReverseBase;
                // Figure out where we came from
                if (diagonal === diagonalMin || (diagonal < diagonalMax && reversePoints[diagonal - 1] >= reversePoints[diagonal + 1])) {
                    // Horizontal line (the element is a deletion))
                    originalIndex = reversePoints[diagonal + 1] - 1;
                    modifiedIndex = originalIndex - diagonalRelative - diagonalReverseOffset;
                    if (originalIndex > lastOriginalIndex) {
                        changeHelper.MarkNextChange();
                    }
                    lastOriginalIndex = originalIndex + 1;
                    changeHelper.AddOriginalElement(originalIndex + 1, modifiedIndex + 1);
                    diagonalRelative = (diagonal + 1) - diagonalReverseBase; //Setup for the next iteration
                }
                else {
                    // Vertical line (the element is an insertion)
                    originalIndex = reversePoints[diagonal - 1];
                    modifiedIndex = originalIndex - diagonalRelative - diagonalReverseOffset;
                    if (originalIndex > lastOriginalIndex) {
                        changeHelper.MarkNextChange();
                    }
                    lastOriginalIndex = originalIndex;
                    changeHelper.AddModifiedElement(originalIndex + 1, modifiedIndex + 1);
                    diagonalRelative = (diagonal - 1) - diagonalReverseBase; //Setup for the next iteration
                }
                if (historyIndex >= 0) {
                    reversePoints = this.m_reverseHistory[historyIndex];
                    diagonalReverseBase = reversePoints[0]; //We stored this in the first spot
                    diagonalMin = 1;
                    diagonalMax = reversePoints.length - 1;
                }
            } while (--historyIndex >= -1);
            // There are cases where the reverse history will find diffs that
            // are correct, but not intuitive, so we need shift them.
            reverseChanges = changeHelper.getChanges();
        }
        return this.ConcatenateChanges(forwardChanges, reverseChanges);
    }
    /**
     * Given the range to compute the diff on, this method finds the point:
     * (midOriginal, midModified)
     * that exists in the middle of the LCS of the two sequences and
     * is the point at which the LCS problem may be broken down recursively.
     * This method will try to keep the LCS trace in memory. If the LCS recursion
     * point is calculated and the full trace is available in memory, then this method
     * will return the change list.
     * @param originalStart The start bound of the original sequence range
     * @param originalEnd The end bound of the original sequence range
     * @param modifiedStart The start bound of the modified sequence range
     * @param modifiedEnd The end bound of the modified sequence range
     * @param midOriginal The middle point of the original sequence range
     * @param midModified The middle point of the modified sequence range
     * @returns The diff changes, if available, otherwise null
     */
    ComputeRecursionPoint(originalStart, originalEnd, modifiedStart, modifiedEnd, midOriginalArr, midModifiedArr, quitEarlyArr) {
        let originalIndex = 0, modifiedIndex = 0;
        let diagonalForwardStart = 0, diagonalForwardEnd = 0;
        let diagonalReverseStart = 0, diagonalReverseEnd = 0;
        // To traverse the edit graph and produce the proper LCS, our actual
        // start position is just outside the given boundary
        originalStart--;
        modifiedStart--;
        // We set these up to make the compiler happy, but they will
        // be replaced before we return with the actual recursion point
        midOriginalArr[0] = 0;
        midModifiedArr[0] = 0;
        // Clear out the history
        this.m_forwardHistory = [];
        this.m_reverseHistory = [];
        // Each cell in the two arrays corresponds to a diagonal in the edit graph.
        // The integer value in the cell represents the originalIndex of the furthest
        // reaching point found so far that ends in that diagonal.
        // The modifiedIndex can be computed mathematically from the originalIndex and the diagonal number.
        const maxDifferences = (originalEnd - originalStart) + (modifiedEnd - modifiedStart);
        const numDiagonals = maxDifferences + 1;
        const forwardPoints = new Int32Array(numDiagonals);
        const reversePoints = new Int32Array(numDiagonals);
        // diagonalForwardBase: Index into forwardPoints of the diagonal which passes through (originalStart, modifiedStart)
        // diagonalReverseBase: Index into reversePoints of the diagonal which passes through (originalEnd, modifiedEnd)
        const diagonalForwardBase = (modifiedEnd - modifiedStart);
        const diagonalReverseBase = (originalEnd - originalStart);
        // diagonalForwardOffset: Geometric offset which allows modifiedIndex to be computed from originalIndex and the
        //    diagonal number (relative to diagonalForwardBase)
        // diagonalReverseOffset: Geometric offset which allows modifiedIndex to be computed from originalIndex and the
        //    diagonal number (relative to diagonalReverseBase)
        const diagonalForwardOffset = (originalStart - modifiedStart);
        const diagonalReverseOffset = (originalEnd - modifiedEnd);
        // delta: The difference between the end diagonal and the start diagonal. This is used to relate diagonal numbers
        //   relative to the start diagonal with diagonal numbers relative to the end diagonal.
        // The Even/Oddn-ness of this delta is important for determining when we should check for overlap
        const delta = diagonalReverseBase - diagonalForwardBase;
        const deltaIsEven = (delta % 2 === 0);
        // Here we set up the start and end points as the furthest points found so far
        // in both the forward and reverse directions, respectively
        forwardPoints[diagonalForwardBase] = originalStart;
        reversePoints[diagonalReverseBase] = originalEnd;
        // Remember if we quit early, and thus need to do a best-effort result instead of a real result.
        quitEarlyArr[0] = false;
        // A couple of points:
        // --With this method, we iterate on the number of differences between the two sequences.
        //   The more differences there actually are, the longer this will take.
        // --Also, as the number of differences increases, we have to search on diagonals further
        //   away from the reference diagonal (which is diagonalForwardBase for forward, diagonalReverseBase for reverse).
        // --We extend on even diagonals (relative to the reference diagonal) only when numDifferences
        //   is even and odd diagonals only when numDifferences is odd.
        for (let numDifferences = 1; numDifferences <= (maxDifferences / 2) + 1; numDifferences++) {
            let furthestOriginalIndex = 0;
            let furthestModifiedIndex = 0;
            // Run the algorithm in the forward direction
            diagonalForwardStart = this.ClipDiagonalBound(diagonalForwardBase - numDifferences, numDifferences, diagonalForwardBase, numDiagonals);
            diagonalForwardEnd = this.ClipDiagonalBound(diagonalForwardBase + numDifferences, numDifferences, diagonalForwardBase, numDiagonals);
            for (let diagonal = diagonalForwardStart; diagonal <= diagonalForwardEnd; diagonal += 2) {
                // STEP 1: We extend the furthest reaching point in the present diagonal
                // by looking at the diagonals above and below and picking the one whose point
                // is further away from the start point (originalStart, modifiedStart)
                if (diagonal === diagonalForwardStart || (diagonal < diagonalForwardEnd && forwardPoints[diagonal - 1] < forwardPoints[diagonal + 1])) {
                    originalIndex = forwardPoints[diagonal + 1];
                }
                else {
                    originalIndex = forwardPoints[diagonal - 1] + 1;
                }
                modifiedIndex = originalIndex - (diagonal - diagonalForwardBase) - diagonalForwardOffset;
                // Save the current originalIndex so we can test for false overlap in step 3
                const tempOriginalIndex = originalIndex;
                // STEP 2: We can continue to extend the furthest reaching point in the present diagonal
                // so long as the elements are equal.
                while (originalIndex < originalEnd && modifiedIndex < modifiedEnd && this.ElementsAreEqual(originalIndex + 1, modifiedIndex + 1)) {
                    originalIndex++;
                    modifiedIndex++;
                }
                forwardPoints[diagonal] = originalIndex;
                if (originalIndex + modifiedIndex > furthestOriginalIndex + furthestModifiedIndex) {
                    furthestOriginalIndex = originalIndex;
                    furthestModifiedIndex = modifiedIndex;
                }
                // STEP 3: If delta is odd (overlap first happens on forward when delta is odd)
                // and diagonal is in the range of reverse diagonals computed for numDifferences-1
                // (the previous iteration; we haven't computed reverse diagonals for numDifferences yet)
                // then check for overlap.
                if (!deltaIsEven && Math.abs(diagonal - diagonalReverseBase) <= (numDifferences - 1)) {
                    if (originalIndex >= reversePoints[diagonal]) {
                        midOriginalArr[0] = originalIndex;
                        midModifiedArr[0] = modifiedIndex;
                        if (tempOriginalIndex <= reversePoints[diagonal] && 1447 /* LocalConstants.MaxDifferencesHistory */ > 0 && numDifferences <= (1447 /* LocalConstants.MaxDifferencesHistory */ + 1)) {
                            // BINGO! We overlapped, and we have the full trace in memory!
                            return this.WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr);
                        }
                        else {
                            // Either false overlap, or we didn't have enough memory for the full trace
                            // Just return the recursion point
                            return null;
                        }
                    }
                }
            }
            // Check to see if we should be quitting early, before moving on to the next iteration.
            const matchLengthOfLongest = ((furthestOriginalIndex - originalStart) + (furthestModifiedIndex - modifiedStart) - numDifferences) / 2;
            if (this.ContinueProcessingPredicate !== null && !this.ContinueProcessingPredicate(furthestOriginalIndex, matchLengthOfLongest)) {
                // We can't finish, so skip ahead to generating a result from what we have.
                quitEarlyArr[0] = true;
                // Use the furthest distance we got in the forward direction.
                midOriginalArr[0] = furthestOriginalIndex;
                midModifiedArr[0] = furthestModifiedIndex;
                if (matchLengthOfLongest > 0 && 1447 /* LocalConstants.MaxDifferencesHistory */ > 0 && numDifferences <= (1447 /* LocalConstants.MaxDifferencesHistory */ + 1)) {
                    // Enough of the history is in memory to walk it backwards
                    return this.WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr);
                }
                else {
                    // We didn't actually remember enough of the history.
                    //Since we are quitting the diff early, we need to shift back the originalStart and modified start
                    //back into the boundary limits since we decremented their value above beyond the boundary limit.
                    originalStart++;
                    modifiedStart++;
                    return [
                        new DiffChange(originalStart, originalEnd - originalStart + 1, modifiedStart, modifiedEnd - modifiedStart + 1)
                    ];
                }
            }
            // Run the algorithm in the reverse direction
            diagonalReverseStart = this.ClipDiagonalBound(diagonalReverseBase - numDifferences, numDifferences, diagonalReverseBase, numDiagonals);
            diagonalReverseEnd = this.ClipDiagonalBound(diagonalReverseBase + numDifferences, numDifferences, diagonalReverseBase, numDiagonals);
            for (let diagonal = diagonalReverseStart; diagonal <= diagonalReverseEnd; diagonal += 2) {
                // STEP 1: We extend the furthest reaching point in the present diagonal
                // by looking at the diagonals above and below and picking the one whose point
                // is further away from the start point (originalEnd, modifiedEnd)
                if (diagonal === diagonalReverseStart || (diagonal < diagonalReverseEnd && reversePoints[diagonal - 1] >= reversePoints[diagonal + 1])) {
                    originalIndex = reversePoints[diagonal + 1] - 1;
                }
                else {
                    originalIndex = reversePoints[diagonal - 1];
                }
                modifiedIndex = originalIndex - (diagonal - diagonalReverseBase) - diagonalReverseOffset;
                // Save the current originalIndex so we can test for false overlap
                const tempOriginalIndex = originalIndex;
                // STEP 2: We can continue to extend the furthest reaching point in the present diagonal
                // as long as the elements are equal.
                while (originalIndex > originalStart && modifiedIndex > modifiedStart && this.ElementsAreEqual(originalIndex, modifiedIndex)) {
                    originalIndex--;
                    modifiedIndex--;
                }
                reversePoints[diagonal] = originalIndex;
                // STEP 4: If delta is even (overlap first happens on reverse when delta is even)
                // and diagonal is in the range of forward diagonals computed for numDifferences
                // then check for overlap.
                if (deltaIsEven && Math.abs(diagonal - diagonalForwardBase) <= numDifferences) {
                    if (originalIndex <= forwardPoints[diagonal]) {
                        midOriginalArr[0] = originalIndex;
                        midModifiedArr[0] = modifiedIndex;
                        if (tempOriginalIndex >= forwardPoints[diagonal] && 1447 /* LocalConstants.MaxDifferencesHistory */ > 0 && numDifferences <= (1447 /* LocalConstants.MaxDifferencesHistory */ + 1)) {
                            // BINGO! We overlapped, and we have the full trace in memory!
                            return this.WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr);
                        }
                        else {
                            // Either false overlap, or we didn't have enough memory for the full trace
                            // Just return the recursion point
                            return null;
                        }
                    }
                }
            }
            // Save current vectors to history before the next iteration
            if (numDifferences <= 1447 /* LocalConstants.MaxDifferencesHistory */) {
                // We are allocating space for one extra int, which we fill with
                // the index of the diagonal base index
                let temp = new Int32Array(diagonalForwardEnd - diagonalForwardStart + 2);
                temp[0] = diagonalForwardBase - diagonalForwardStart + 1;
                MyArray.Copy2(forwardPoints, diagonalForwardStart, temp, 1, diagonalForwardEnd - diagonalForwardStart + 1);
                this.m_forwardHistory.push(temp);
                temp = new Int32Array(diagonalReverseEnd - diagonalReverseStart + 2);
                temp[0] = diagonalReverseBase - diagonalReverseStart + 1;
                MyArray.Copy2(reversePoints, diagonalReverseStart, temp, 1, diagonalReverseEnd - diagonalReverseStart + 1);
                this.m_reverseHistory.push(temp);
            }
        }
        // If we got here, then we have the full trace in history. We just have to convert it to a change list
        // NOTE: This part is a bit messy
        return this.WALKTRACE(diagonalForwardBase, diagonalForwardStart, diagonalForwardEnd, diagonalForwardOffset, diagonalReverseBase, diagonalReverseStart, diagonalReverseEnd, diagonalReverseOffset, forwardPoints, reversePoints, originalIndex, originalEnd, midOriginalArr, modifiedIndex, modifiedEnd, midModifiedArr, deltaIsEven, quitEarlyArr);
    }
    /**
     * Shifts the given changes to provide a more intuitive diff.
     * While the first element in a diff matches the first element after the diff,
     * we shift the diff down.
     *
     * @param changes The list of changes to shift
     * @returns The shifted changes
     */
    PrettifyChanges(changes) {
        // Shift all the changes down first
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            const originalStop = (i < changes.length - 1) ? changes[i + 1].originalStart : this._originalElementsOrHash.length;
            const modifiedStop = (i < changes.length - 1) ? changes[i + 1].modifiedStart : this._modifiedElementsOrHash.length;
            const checkOriginal = change.originalLength > 0;
            const checkModified = change.modifiedLength > 0;
            while (change.originalStart + change.originalLength < originalStop
                && change.modifiedStart + change.modifiedLength < modifiedStop
                && (!checkOriginal || this.OriginalElementsAreEqual(change.originalStart, change.originalStart + change.originalLength))
                && (!checkModified || this.ModifiedElementsAreEqual(change.modifiedStart, change.modifiedStart + change.modifiedLength))) {
                const startStrictEqual = this.ElementsAreStrictEqual(change.originalStart, change.modifiedStart);
                const endStrictEqual = this.ElementsAreStrictEqual(change.originalStart + change.originalLength, change.modifiedStart + change.modifiedLength);
                if (endStrictEqual && !startStrictEqual) {
                    // moving the change down would create an equal change, but the elements are not strict equal
                    break;
                }
                change.originalStart++;
                change.modifiedStart++;
            }
            const mergedChangeArr = [null];
            if (i < changes.length - 1 && this.ChangesOverlap(changes[i], changes[i + 1], mergedChangeArr)) {
                changes[i] = mergedChangeArr[0];
                changes.splice(i + 1, 1);
                i--;
                continue;
            }
        }
        // Shift changes back up until we hit empty or whitespace-only lines
        for (let i = changes.length - 1; i >= 0; i--) {
            const change = changes[i];
            let originalStop = 0;
            let modifiedStop = 0;
            if (i > 0) {
                const prevChange = changes[i - 1];
                originalStop = prevChange.originalStart + prevChange.originalLength;
                modifiedStop = prevChange.modifiedStart + prevChange.modifiedLength;
            }
            const checkOriginal = change.originalLength > 0;
            const checkModified = change.modifiedLength > 0;
            let bestDelta = 0;
            let bestScore = this._boundaryScore(change.originalStart, change.originalLength, change.modifiedStart, change.modifiedLength);
            for (let delta = 1;; delta++) {
                const originalStart = change.originalStart - delta;
                const modifiedStart = change.modifiedStart - delta;
                if (originalStart < originalStop || modifiedStart < modifiedStop) {
                    break;
                }
                if (checkOriginal && !this.OriginalElementsAreEqual(originalStart, originalStart + change.originalLength)) {
                    break;
                }
                if (checkModified && !this.ModifiedElementsAreEqual(modifiedStart, modifiedStart + change.modifiedLength)) {
                    break;
                }
                const touchingPreviousChange = (originalStart === originalStop && modifiedStart === modifiedStop);
                const score = ((touchingPreviousChange ? 5 : 0)
                    + this._boundaryScore(originalStart, change.originalLength, modifiedStart, change.modifiedLength));
                if (score > bestScore) {
                    bestScore = score;
                    bestDelta = delta;
                }
            }
            change.originalStart -= bestDelta;
            change.modifiedStart -= bestDelta;
            const mergedChangeArr = [null];
            if (i > 0 && this.ChangesOverlap(changes[i - 1], changes[i], mergedChangeArr)) {
                changes[i - 1] = mergedChangeArr[0];
                changes.splice(i, 1);
                i++;
                continue;
            }
        }
        // There could be multiple longest common substrings.
        // Give preference to the ones containing longer lines
        if (this._hasStrings) {
            for (let i = 1, len = changes.length; i < len; i++) {
                const aChange = changes[i - 1];
                const bChange = changes[i];
                const matchedLength = bChange.originalStart - aChange.originalStart - aChange.originalLength;
                const aOriginalStart = aChange.originalStart;
                const bOriginalEnd = bChange.originalStart + bChange.originalLength;
                const abOriginalLength = bOriginalEnd - aOriginalStart;
                const aModifiedStart = aChange.modifiedStart;
                const bModifiedEnd = bChange.modifiedStart + bChange.modifiedLength;
                const abModifiedLength = bModifiedEnd - aModifiedStart;
                // Avoid wasting a lot of time with these searches
                if (matchedLength < 5 && abOriginalLength < 20 && abModifiedLength < 20) {
                    const t = this._findBetterContiguousSequence(aOriginalStart, abOriginalLength, aModifiedStart, abModifiedLength, matchedLength);
                    if (t) {
                        const [originalMatchStart, modifiedMatchStart] = t;
                        if (originalMatchStart !== aChange.originalStart + aChange.originalLength || modifiedMatchStart !== aChange.modifiedStart + aChange.modifiedLength) {
                            // switch to another sequence that has a better score
                            aChange.originalLength = originalMatchStart - aChange.originalStart;
                            aChange.modifiedLength = modifiedMatchStart - aChange.modifiedStart;
                            bChange.originalStart = originalMatchStart + matchedLength;
                            bChange.modifiedStart = modifiedMatchStart + matchedLength;
                            bChange.originalLength = bOriginalEnd - bChange.originalStart;
                            bChange.modifiedLength = bModifiedEnd - bChange.modifiedStart;
                        }
                    }
                }
            }
        }
        return changes;
    }
    _findBetterContiguousSequence(originalStart, originalLength, modifiedStart, modifiedLength, desiredLength) {
        if (originalLength < desiredLength || modifiedLength < desiredLength) {
            return null;
        }
        const originalMax = originalStart + originalLength - desiredLength + 1;
        const modifiedMax = modifiedStart + modifiedLength - desiredLength + 1;
        let bestScore = 0;
        let bestOriginalStart = 0;
        let bestModifiedStart = 0;
        for (let i = originalStart; i < originalMax; i++) {
            for (let j = modifiedStart; j < modifiedMax; j++) {
                const score = this._contiguousSequenceScore(i, j, desiredLength);
                if (score > 0 && score > bestScore) {
                    bestScore = score;
                    bestOriginalStart = i;
                    bestModifiedStart = j;
                }
            }
        }
        if (bestScore > 0) {
            return [bestOriginalStart, bestModifiedStart];
        }
        return null;
    }
    _contiguousSequenceScore(originalStart, modifiedStart, length) {
        let score = 0;
        for (let l = 0; l < length; l++) {
            if (!this.ElementsAreEqual(originalStart + l, modifiedStart + l)) {
                return 0;
            }
            score += this._originalStringElements[originalStart + l].length;
        }
        return score;
    }
    _OriginalIsBoundary(index) {
        if (index <= 0 || index >= this._originalElementsOrHash.length - 1) {
            return true;
        }
        return (this._hasStrings && /^\s*$/.test(this._originalStringElements[index]));
    }
    _OriginalRegionIsBoundary(originalStart, originalLength) {
        if (this._OriginalIsBoundary(originalStart) || this._OriginalIsBoundary(originalStart - 1)) {
            return true;
        }
        if (originalLength > 0) {
            const originalEnd = originalStart + originalLength;
            if (this._OriginalIsBoundary(originalEnd - 1) || this._OriginalIsBoundary(originalEnd)) {
                return true;
            }
        }
        return false;
    }
    _ModifiedIsBoundary(index) {
        if (index <= 0 || index >= this._modifiedElementsOrHash.length - 1) {
            return true;
        }
        return (this._hasStrings && /^\s*$/.test(this._modifiedStringElements[index]));
    }
    _ModifiedRegionIsBoundary(modifiedStart, modifiedLength) {
        if (this._ModifiedIsBoundary(modifiedStart) || this._ModifiedIsBoundary(modifiedStart - 1)) {
            return true;
        }
        if (modifiedLength > 0) {
            const modifiedEnd = modifiedStart + modifiedLength;
            if (this._ModifiedIsBoundary(modifiedEnd - 1) || this._ModifiedIsBoundary(modifiedEnd)) {
                return true;
            }
        }
        return false;
    }
    _boundaryScore(originalStart, originalLength, modifiedStart, modifiedLength) {
        const originalScore = (this._OriginalRegionIsBoundary(originalStart, originalLength) ? 1 : 0);
        const modifiedScore = (this._ModifiedRegionIsBoundary(modifiedStart, modifiedLength) ? 1 : 0);
        return (originalScore + modifiedScore);
    }
    /**
     * Concatenates the two input DiffChange lists and returns the resulting
     * list.
     * @param The left changes
     * @param The right changes
     * @returns The concatenated list
     */
    ConcatenateChanges(left, right) {
        const mergedChangeArr = [];
        if (left.length === 0 || right.length === 0) {
            return (right.length > 0) ? right : left;
        }
        else if (this.ChangesOverlap(left[left.length - 1], right[0], mergedChangeArr)) {
            // Since we break the problem down recursively, it is possible that we
            // might recurse in the middle of a change thereby splitting it into
            // two changes. Here in the combining stage, we detect and fuse those
            // changes back together
            const result = new Array(left.length + right.length - 1);
            MyArray.Copy(left, 0, result, 0, left.length - 1);
            result[left.length - 1] = mergedChangeArr[0];
            MyArray.Copy(right, 1, result, left.length, right.length - 1);
            return result;
        }
        else {
            const result = new Array(left.length + right.length);
            MyArray.Copy(left, 0, result, 0, left.length);
            MyArray.Copy(right, 0, result, left.length, right.length);
            return result;
        }
    }
    /**
     * Returns true if the two changes overlap and can be merged into a single
     * change
     * @param left The left change
     * @param right The right change
     * @param mergedChange The merged change if the two overlap, null otherwise
     * @returns True if the two changes overlap
     */
    ChangesOverlap(left, right, mergedChangeArr) {
        Debug.Assert(left.originalStart <= right.originalStart, 'Left change is not less than or equal to right change');
        Debug.Assert(left.modifiedStart <= right.modifiedStart, 'Left change is not less than or equal to right change');
        if (left.originalStart + left.originalLength >= right.originalStart || left.modifiedStart + left.modifiedLength >= right.modifiedStart) {
            const originalStart = left.originalStart;
            let originalLength = left.originalLength;
            const modifiedStart = left.modifiedStart;
            let modifiedLength = left.modifiedLength;
            if (left.originalStart + left.originalLength >= right.originalStart) {
                originalLength = right.originalStart + right.originalLength - left.originalStart;
            }
            if (left.modifiedStart + left.modifiedLength >= right.modifiedStart) {
                modifiedLength = right.modifiedStart + right.modifiedLength - left.modifiedStart;
            }
            mergedChangeArr[0] = new DiffChange(originalStart, originalLength, modifiedStart, modifiedLength);
            return true;
        }
        else {
            mergedChangeArr[0] = null;
            return false;
        }
    }
    /**
     * Helper method used to clip a diagonal index to the range of valid
     * diagonals. This also decides whether or not the diagonal index,
     * if it exceeds the boundary, should be clipped to the boundary or clipped
     * one inside the boundary depending on the Even/Odd status of the boundary
     * and numDifferences.
     * @param diagonal The index of the diagonal to clip.
     * @param numDifferences The current number of differences being iterated upon.
     * @param diagonalBaseIndex The base reference diagonal.
     * @param numDiagonals The total number of diagonals.
     * @returns The clipped diagonal index.
     */
    ClipDiagonalBound(diagonal, numDifferences, diagonalBaseIndex, numDiagonals) {
        if (diagonal >= 0 && diagonal < numDiagonals) {
            // Nothing to clip, its in range
            return diagonal;
        }
        // diagonalsBelow: The number of diagonals below the reference diagonal
        // diagonalsAbove: The number of diagonals above the reference diagonal
        const diagonalsBelow = diagonalBaseIndex;
        const diagonalsAbove = numDiagonals - diagonalBaseIndex - 1;
        const diffEven = (numDifferences % 2 === 0);
        if (diagonal < 0) {
            const lowerBoundEven = (diagonalsBelow % 2 === 0);
            return (diffEven === lowerBoundEven) ? 0 : 1;
        }
        else {
            const upperBoundEven = (diagonalsAbove % 2 === 0);
            return (diffEven === upperBoundEven) ? numDiagonals - 1 : numDiagonals - 2;
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
let safeProcess;
// Native sandbox environment
const vscodeGlobal = globalThis.vscode;
if (typeof vscodeGlobal !== 'undefined' && typeof vscodeGlobal.process !== 'undefined') {
    const sandboxProcess = vscodeGlobal.process;
    safeProcess = {
        get platform() { return sandboxProcess.platform; },
        get arch() { return sandboxProcess.arch; },
        get env() { return sandboxProcess.env; },
        cwd() { return sandboxProcess.cwd(); }
    };
}
// Native node.js environment
else if (typeof process !== 'undefined') {
    safeProcess = {
        get platform() { return process.platform; },
        get arch() { return process.arch; },
        get env() { return process.env; },
        cwd() { return process.env['VSCODE_CWD'] || process.cwd(); }
    };
}
// Web environment
else {
    safeProcess = {
        // Supported
        get platform() { return isWindows ? 'win32' : isMacintosh ? 'darwin' : 'linux'; },
        get arch() { return undefined; /* arch is undefined in web */ },
        // Unsupported
        get env() { return {}; },
        cwd() { return '/'; }
    };
}
/**
 * Provides safe access to the `cwd` property in node.js, sandboxed or web
 * environments.
 *
 * Note: in web, this property is hardcoded to be `/`.
 *
 * @skipMangle
 */
const cwd = safeProcess.cwd;
/**
 * Provides safe access to the `env` property in node.js, sandboxed or web
 * environments.
 *
 * Note: in web, this property is hardcoded to be `{}`.
 */
const env = safeProcess.env;
/**
 * Provides safe access to the `platform` property in node.js, sandboxed or web
 * environments.
 */
const platform = safeProcess.platform;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// NOTE: VSCode's copy of nodejs path library to be usable in common (non-node) namespace
// Copied from: https://github.com/nodejs/node/blob/v16.14.2/lib/path.js
/**
 * Copyright Joyent, Inc. and other Node contributors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const CHAR_UPPERCASE_A = 65; /* A */
const CHAR_LOWERCASE_A = 97; /* a */
const CHAR_UPPERCASE_Z = 90; /* Z */
const CHAR_LOWERCASE_Z = 122; /* z */
const CHAR_DOT = 46; /* . */
const CHAR_FORWARD_SLASH = 47; /* / */
const CHAR_BACKWARD_SLASH = 92; /* \ */
const CHAR_COLON = 58; /* : */
const CHAR_QUESTION_MARK = 63; /* ? */
class ErrorInvalidArgType extends Error {
    constructor(name, expected, actual) {
        // determiner: 'must be' or 'must not be'
        let determiner;
        if (typeof expected === 'string' && expected.indexOf('not ') === 0) {
            determiner = 'must not be';
            expected = expected.replace(/^not /, '');
        }
        else {
            determiner = 'must be';
        }
        const type = name.indexOf('.') !== -1 ? 'property' : 'argument';
        let msg = `The "${name}" ${type} ${determiner} of type ${expected}`;
        msg += `. Received type ${typeof actual}`;
        super(msg);
        this.code = 'ERR_INVALID_ARG_TYPE';
    }
}
function validateObject(pathObject, name) {
    if (pathObject === null || typeof pathObject !== 'object') {
        throw new ErrorInvalidArgType(name, 'Object', pathObject);
    }
}
function validateString(value, name) {
    if (typeof value !== 'string') {
        throw new ErrorInvalidArgType(name, 'string', value);
    }
}
const platformIsWin32 = (platform === 'win32');
function isPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isPosixPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
    return (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z) ||
        (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z);
}
// Resolves . and .. elements in a path with directory names
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = '';
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code = 0;
    for (let i = 0; i <= path.length; ++i) {
        if (i < path.length) {
            code = path.charCodeAt(i);
        }
        else if (isPathSeparator(code)) {
            break;
        }
        else {
            code = CHAR_FORWARD_SLASH;
        }
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) ;
            else if (dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 ||
                    res.charCodeAt(res.length - 1) !== CHAR_DOT ||
                    res.charCodeAt(res.length - 2) !== CHAR_DOT) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = '';
                            lastSegmentLength = 0;
                        }
                        else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                    else if (res.length !== 0) {
                        res = '';
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    res += res.length > 0 ? `${separator}..` : '..';
                    lastSegmentLength = 2;
                }
            }
            else {
                if (res.length > 0) {
                    res += `${separator}${path.slice(lastSlash + 1, i)}`;
                }
                else {
                    res = path.slice(lastSlash + 1, i);
                }
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        }
        else if (code === CHAR_DOT && dots !== -1) {
            ++dots;
        }
        else {
            dots = -1;
        }
    }
    return res;
}
function _format(sep, pathObject) {
    validateObject(pathObject, 'pathObject');
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base ||
        `${pathObject.name || ''}${pathObject.ext || ''}`;
    if (!dir) {
        return base;
    }
    return dir === pathObject.root ? `${dir}${base}` : `${dir}${sep}${base}`;
}
const win32 = {
    // path.resolve([from ...], to)
    resolve(...pathSegments) {
        let resolvedDevice = '';
        let resolvedTail = '';
        let resolvedAbsolute = false;
        for (let i = pathSegments.length - 1; i >= -1; i--) {
            let path;
            if (i >= 0) {
                path = pathSegments[i];
                validateString(path, 'path');
                // Skip empty entries
                if (path.length === 0) {
                    continue;
                }
            }
            else if (resolvedDevice.length === 0) {
                path = cwd();
            }
            else {
                // Windows has the concept of drive-specific current working
                // directories. If we've resolved a drive letter but not yet an
                // absolute path, get cwd for that drive, or the process cwd if
                // the drive cwd is not available. We're sure the device is not
                // a UNC path at this points, because UNC paths are always absolute.
                path = env[`=${resolvedDevice}`] || cwd();
                // Verify that a cwd was found and that it actually points
                // to our drive. If not, default to the drive's root.
                if (path === undefined ||
                    (path.slice(0, 2).toLowerCase() !== resolvedDevice.toLowerCase() &&
                        path.charCodeAt(2) === CHAR_BACKWARD_SLASH)) {
                    path = `${resolvedDevice}\\`;
                }
            }
            const len = path.length;
            let rootEnd = 0;
            let device = '';
            let isAbsolute = false;
            const code = path.charCodeAt(0);
            // Try to match a root
            if (len === 1) {
                if (isPathSeparator(code)) {
                    // `path` contains just a path separator
                    rootEnd = 1;
                    isAbsolute = true;
                }
            }
            else if (isPathSeparator(code)) {
                // Possible UNC root
                // If we started with a separator, we know we at least have an
                // absolute path of some kind (UNC or otherwise)
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    // Matched double path separator at beginning
                    let j = 2;
                    let last = j;
                    // Match 1 or more non-path separators
                    while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                        j++;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        // Matched!
                        last = j;
                        // Match 1 or more path separators
                        while (j < len && isPathSeparator(path.charCodeAt(j))) {
                            j++;
                        }
                        if (j < len && j !== last) {
                            // Matched!
                            last = j;
                            // Match 1 or more non-path separators
                            while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                                j++;
                            }
                            if (j === len || j !== last) {
                                // We matched a UNC root
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                }
                else {
                    rootEnd = 1;
                }
            }
            else if (isWindowsDeviceRoot(code) &&
                path.charCodeAt(1) === CHAR_COLON) {
                // Possible device root
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2 && isPathSeparator(path.charCodeAt(2))) {
                    // Treat separator following drive name as an absolute path
                    // indicator
                    isAbsolute = true;
                    rootEnd = 3;
                }
            }
            if (device.length > 0) {
                if (resolvedDevice.length > 0) {
                    if (device.toLowerCase() !== resolvedDevice.toLowerCase()) {
                        // This path points to another device so it is not applicable
                        continue;
                    }
                }
                else {
                    resolvedDevice = device;
                }
            }
            if (resolvedAbsolute) {
                if (resolvedDevice.length > 0) {
                    break;
                }
            }
            else {
                resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
                resolvedAbsolute = isAbsolute;
                if (isAbsolute && resolvedDevice.length > 0) {
                    break;
                }
            }
        }
        // At this point the path should be resolved to a full absolute path,
        // but handle relative paths to be safe (might happen when process.cwd()
        // fails)
        // Normalize the tail path
        resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, '\\', isPathSeparator);
        return resolvedAbsolute ?
            `${resolvedDevice}\\${resolvedTail}` :
            `${resolvedDevice}${resolvedTail}` || '.';
    },
    normalize(path) {
        validateString(path, 'path');
        const len = path.length;
        if (len === 0) {
            return '.';
        }
        let rootEnd = 0;
        let device;
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        // Try to match a root
        if (len === 1) {
            // `path` contains just a single char, exit early to avoid
            // unnecessary work
            return isPosixPathSeparator(code) ? '\\' : path;
        }
        if (isPathSeparator(code)) {
            // Possible UNC root
            // If we started with a separator, we know we at least have an absolute
            // path of some kind (UNC or otherwise)
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                // Matched double path separator at beginning
                let j = 2;
                let last = j;
                // Match 1 or more non-path separators
                while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                    j++;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    // Matched!
                    last = j;
                    // Match 1 or more path separators
                    while (j < len && isPathSeparator(path.charCodeAt(j))) {
                        j++;
                    }
                    if (j < len && j !== last) {
                        // Matched!
                        last = j;
                        // Match 1 or more non-path separators
                        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                            j++;
                        }
                        if (j === len) {
                            // We matched a UNC root only
                            // Return the normalized version of the UNC root since there
                            // is nothing left to process
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        }
                        if (j !== last) {
                            // We matched a UNC root with leftovers
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            }
            else {
                rootEnd = 1;
            }
        }
        else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
            // Possible device root
            device = path.slice(0, 2);
            rootEnd = 2;
            if (len > 2 && isPathSeparator(path.charCodeAt(2))) {
                // Treat separator following drive name as an absolute path
                // indicator
                isAbsolute = true;
                rootEnd = 3;
            }
        }
        let tail = rootEnd < len ?
            normalizeString(path.slice(rootEnd), !isAbsolute, '\\', isPathSeparator) :
            '';
        if (tail.length === 0 && !isAbsolute) {
            tail = '.';
        }
        if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
            tail += '\\';
        }
        if (device === undefined) {
            return isAbsolute ? `\\${tail}` : tail;
        }
        return isAbsolute ? `${device}\\${tail}` : `${device}${tail}`;
    },
    isAbsolute(path) {
        validateString(path, 'path');
        const len = path.length;
        if (len === 0) {
            return false;
        }
        const code = path.charCodeAt(0);
        return isPathSeparator(code) ||
            // Possible device root
            (len > 2 &&
                isWindowsDeviceRoot(code) &&
                path.charCodeAt(1) === CHAR_COLON &&
                isPathSeparator(path.charCodeAt(2)));
    },
    join(...paths) {
        if (paths.length === 0) {
            return '.';
        }
        let joined;
        let firstPart;
        for (let i = 0; i < paths.length; ++i) {
            const arg = paths[i];
            validateString(arg, 'path');
            if (arg.length > 0) {
                if (joined === undefined) {
                    joined = firstPart = arg;
                }
                else {
                    joined += `\\${arg}`;
                }
            }
        }
        if (joined === undefined) {
            return '.';
        }
        // Make sure that the joined path doesn't start with two slashes, because
        // normalize() will mistake it for a UNC path then.
        //
        // This step is skipped when it is very clear that the user actually
        // intended to point at a UNC path. This is assumed when the first
        // non-empty string arguments starts with exactly two slashes followed by
        // at least one more non-slash character.
        //
        // Note that for normalize() to treat a path as a UNC path it needs to
        // have at least 2 components, so we don't filter for that here.
        // This means that the user can use join to construct UNC paths from
        // a server name and a share name; for example:
        //   path.join('//server', 'share') -> '\\\\server\\share\\')
        let needsReplace = true;
        let slashCount = 0;
        if (typeof firstPart === 'string' && isPathSeparator(firstPart.charCodeAt(0))) {
            ++slashCount;
            const firstLen = firstPart.length;
            if (firstLen > 1 && isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2))) {
                        ++slashCount;
                    }
                    else {
                        // We matched a UNC path in the first part
                        needsReplace = false;
                    }
                }
            }
        }
        if (needsReplace) {
            // Find any more consecutive slashes we need to replace
            while (slashCount < joined.length &&
                isPathSeparator(joined.charCodeAt(slashCount))) {
                slashCount++;
            }
            // Replace the slashes if needed
            if (slashCount >= 2) {
                joined = `\\${joined.slice(slashCount)}`;
            }
        }
        return win32.normalize(joined);
    },
    // It will solve the relative path from `from` to `to`, for instance:
    //  from = 'C:\\orandea\\test\\aaa'
    //  to = 'C:\\orandea\\impl\\bbb'
    // The output of the function should be: '..\\..\\impl\\bbb'
    relative(from, to) {
        validateString(from, 'from');
        validateString(to, 'to');
        if (from === to) {
            return '';
        }
        const fromOrig = win32.resolve(from);
        const toOrig = win32.resolve(to);
        if (fromOrig === toOrig) {
            return '';
        }
        from = fromOrig.toLowerCase();
        to = toOrig.toLowerCase();
        if (from === to) {
            return '';
        }
        // Trim any leading backslashes
        let fromStart = 0;
        while (fromStart < from.length &&
            from.charCodeAt(fromStart) === CHAR_BACKWARD_SLASH) {
            fromStart++;
        }
        // Trim trailing backslashes (applicable to UNC paths only)
        let fromEnd = from.length;
        while (fromEnd - 1 > fromStart &&
            from.charCodeAt(fromEnd - 1) === CHAR_BACKWARD_SLASH) {
            fromEnd--;
        }
        const fromLen = fromEnd - fromStart;
        // Trim any leading backslashes
        let toStart = 0;
        while (toStart < to.length &&
            to.charCodeAt(toStart) === CHAR_BACKWARD_SLASH) {
            toStart++;
        }
        // Trim trailing backslashes (applicable to UNC paths only)
        let toEnd = to.length;
        while (toEnd - 1 > toStart &&
            to.charCodeAt(toEnd - 1) === CHAR_BACKWARD_SLASH) {
            toEnd--;
        }
        const toLen = toEnd - toStart;
        // Compare paths to find the longest common path from root
        const length = fromLen < toLen ? fromLen : toLen;
        let lastCommonSep = -1;
        let i = 0;
        for (; i < length; i++) {
            const fromCode = from.charCodeAt(fromStart + i);
            if (fromCode !== to.charCodeAt(toStart + i)) {
                break;
            }
            else if (fromCode === CHAR_BACKWARD_SLASH) {
                lastCommonSep = i;
            }
        }
        // We found a mismatch before the first common path separator was seen, so
        // return the original `to`.
        if (i !== length) {
            if (lastCommonSep === -1) {
                return toOrig;
            }
        }
        else {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === CHAR_BACKWARD_SLASH) {
                    // We get here if `from` is the exact base path for `to`.
                    // For example: from='C:\\foo\\bar'; to='C:\\foo\\bar\\baz'
                    return toOrig.slice(toStart + i + 1);
                }
                if (i === 2) {
                    // We get here if `from` is the device root.
                    // For example: from='C:\\'; to='C:\\foo'
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === CHAR_BACKWARD_SLASH) {
                    // We get here if `to` is the exact base path for `from`.
                    // For example: from='C:\\foo\\bar'; to='C:\\foo'
                    lastCommonSep = i;
                }
                else if (i === 2) {
                    // We get here if `to` is the device root.
                    // For example: from='C:\\foo\\bar'; to='C:\\'
                    lastCommonSep = 3;
                }
            }
            if (lastCommonSep === -1) {
                lastCommonSep = 0;
            }
        }
        let out = '';
        // Generate the relative path based on the path difference between `to` and
        // `from`
        for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
            if (i === fromEnd || from.charCodeAt(i) === CHAR_BACKWARD_SLASH) {
                out += out.length === 0 ? '..' : '\\..';
            }
        }
        toStart += lastCommonSep;
        // Lastly, append the rest of the destination (`to`) path that comes after
        // the common path parts
        if (out.length > 0) {
            return `${out}${toOrig.slice(toStart, toEnd)}`;
        }
        if (toOrig.charCodeAt(toStart) === CHAR_BACKWARD_SLASH) {
            ++toStart;
        }
        return toOrig.slice(toStart, toEnd);
    },
    toNamespacedPath(path) {
        // Note: this will *probably* throw somewhere.
        if (typeof path !== 'string' || path.length === 0) {
            return path;
        }
        const resolvedPath = win32.resolve(path);
        if (resolvedPath.length <= 2) {
            return path;
        }
        if (resolvedPath.charCodeAt(0) === CHAR_BACKWARD_SLASH) {
            // Possible UNC root
            if (resolvedPath.charCodeAt(1) === CHAR_BACKWARD_SLASH) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== CHAR_QUESTION_MARK && code !== CHAR_DOT) {
                    // Matched non-long UNC root, convert the path to a long UNC path
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        }
        else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0)) &&
            resolvedPath.charCodeAt(1) === CHAR_COLON &&
            resolvedPath.charCodeAt(2) === CHAR_BACKWARD_SLASH) {
            // Matched device root, convert the path to a long UNC path
            return `\\\\?\\${resolvedPath}`;
        }
        return path;
    },
    dirname(path) {
        validateString(path, 'path');
        const len = path.length;
        if (len === 0) {
            return '.';
        }
        let rootEnd = -1;
        let offset = 0;
        const code = path.charCodeAt(0);
        if (len === 1) {
            // `path` contains just a path separator, exit early to avoid
            // unnecessary work or a dot.
            return isPathSeparator(code) ? path : '.';
        }
        // Try to match a root
        if (isPathSeparator(code)) {
            // Possible UNC root
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                // Matched double path separator at beginning
                let j = 2;
                let last = j;
                // Match 1 or more non-path separators
                while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                    j++;
                }
                if (j < len && j !== last) {
                    // Matched!
                    last = j;
                    // Match 1 or more path separators
                    while (j < len && isPathSeparator(path.charCodeAt(j))) {
                        j++;
                    }
                    if (j < len && j !== last) {
                        // Matched!
                        last = j;
                        // Match 1 or more non-path separators
                        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                            j++;
                        }
                        if (j === len) {
                            // We matched a UNC root only
                            return path;
                        }
                        if (j !== last) {
                            // We matched a UNC root with leftovers
                            // Offset by 1 to include the separator after the UNC root to
                            // treat it as a "normal root" on top of a (UNC) root
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
            // Possible device root
        }
        else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
            rootEnd = len > 2 && isPathSeparator(path.charCodeAt(2)) ? 3 : 2;
            offset = rootEnd;
        }
        let end = -1;
        let matchedSlash = true;
        for (let i = len - 1; i >= offset; --i) {
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    end = i;
                    break;
                }
            }
            else {
                // We saw the first non-path separator
                matchedSlash = false;
            }
        }
        if (end === -1) {
            if (rootEnd === -1) {
                return '.';
            }
            end = rootEnd;
        }
        return path.slice(0, end);
    },
    basename(path, ext) {
        if (ext !== undefined) {
            validateString(ext, 'ext');
        }
        validateString(path, 'path');
        let start = 0;
        let end = -1;
        let matchedSlash = true;
        let i;
        // Check for a drive letter prefix so as not to mistake the following
        // path separator as an extra separator at the end of the path that can be
        // disregarded
        if (path.length >= 2 &&
            isWindowsDeviceRoot(path.charCodeAt(0)) &&
            path.charCodeAt(1) === CHAR_COLON) {
            start = 2;
        }
        if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
            if (ext === path) {
                return '';
            }
            let extIdx = ext.length - 1;
            let firstNonSlashEnd = -1;
            for (i = path.length - 1; i >= start; --i) {
                const code = path.charCodeAt(i);
                if (isPathSeparator(code)) {
                    // If we reached a path separator that was not part of a set of path
                    // separators at the end of the string, stop now
                    if (!matchedSlash) {
                        start = i + 1;
                        break;
                    }
                }
                else {
                    if (firstNonSlashEnd === -1) {
                        // We saw the first non-path separator, remember this index in case
                        // we need it if the extension ends up not matching
                        matchedSlash = false;
                        firstNonSlashEnd = i + 1;
                    }
                    if (extIdx >= 0) {
                        // Try to match the explicit extension
                        if (code === ext.charCodeAt(extIdx)) {
                            if (--extIdx === -1) {
                                // We matched the extension, so mark this as the end of our path
                                // component
                                end = i;
                            }
                        }
                        else {
                            // Extension does not match, so our result is the entire path
                            // component
                            extIdx = -1;
                            end = firstNonSlashEnd;
                        }
                    }
                }
            }
            if (start === end) {
                end = firstNonSlashEnd;
            }
            else if (end === -1) {
                end = path.length;
            }
            return path.slice(start, end);
        }
        for (i = path.length - 1; i >= start; --i) {
            if (isPathSeparator(path.charCodeAt(i))) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            }
            else if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // path component
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) {
            return '';
        }
        return path.slice(start, end);
    },
    extname(path) {
        validateString(path, 'path');
        let start = 0;
        let startDot = -1;
        let startPart = 0;
        let end = -1;
        let matchedSlash = true;
        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;
        // Check for a drive letter prefix so as not to mistake the following
        // path separator as an extra separator at the end of the path that can be
        // disregarded
        if (path.length >= 2 &&
            path.charCodeAt(1) === CHAR_COLON &&
            isWindowsDeviceRoot(path.charCodeAt(0))) {
            start = startPart = 2;
        }
        for (let i = path.length - 1; i >= start; --i) {
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }
                continue;
            }
            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }
            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                }
                else if (preDotState !== 1) {
                    preDotState = 1;
                }
            }
            else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }
        if (startDot === -1 ||
            end === -1 ||
            // We saw a non-dot character immediately before the dot
            preDotState === 0 ||
            // The (right-most) trimmed path component is exactly '..'
            (preDotState === 1 &&
                startDot === end - 1 &&
                startDot === startPart + 1)) {
            return '';
        }
        return path.slice(startDot, end);
    },
    format: _format.bind(null, '\\'),
    parse(path) {
        validateString(path, 'path');
        const ret = { root: '', dir: '', base: '', ext: '', name: '' };
        if (path.length === 0) {
            return ret;
        }
        const len = path.length;
        let rootEnd = 0;
        let code = path.charCodeAt(0);
        if (len === 1) {
            if (isPathSeparator(code)) {
                // `path` contains just a path separator, exit early to avoid
                // unnecessary work
                ret.root = ret.dir = path;
                return ret;
            }
            ret.base = ret.name = path;
            return ret;
        }
        // Try to match a root
        if (isPathSeparator(code)) {
            // Possible UNC root
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                // Matched double path separator at beginning
                let j = 2;
                let last = j;
                // Match 1 or more non-path separators
                while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                    j++;
                }
                if (j < len && j !== last) {
                    // Matched!
                    last = j;
                    // Match 1 or more path separators
                    while (j < len && isPathSeparator(path.charCodeAt(j))) {
                        j++;
                    }
                    if (j < len && j !== last) {
                        // Matched!
                        last = j;
                        // Match 1 or more non-path separators
                        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                            j++;
                        }
                        if (j === len) {
                            // We matched a UNC root only
                            rootEnd = j;
                        }
                        else if (j !== last) {
                            // We matched a UNC root with leftovers
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        }
        else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
            // Possible device root
            if (len <= 2) {
                // `path` contains just a drive root, exit early to avoid
                // unnecessary work
                ret.root = ret.dir = path;
                return ret;
            }
            rootEnd = 2;
            if (isPathSeparator(path.charCodeAt(2))) {
                if (len === 3) {
                    // `path` contains just a drive root, exit early to avoid
                    // unnecessary work
                    ret.root = ret.dir = path;
                    return ret;
                }
                rootEnd = 3;
            }
        }
        if (rootEnd > 0) {
            ret.root = path.slice(0, rootEnd);
        }
        let startDot = -1;
        let startPart = rootEnd;
        let end = -1;
        let matchedSlash = true;
        let i = path.length - 1;
        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;
        // Get non-dir info
        for (; i >= rootEnd; --i) {
            code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }
                continue;
            }
            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }
            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                }
                else if (preDotState !== 1) {
                    preDotState = 1;
                }
            }
            else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }
        if (end !== -1) {
            if (startDot === -1 ||
                // We saw a non-dot character immediately before the dot
                preDotState === 0 ||
                // The (right-most) trimmed path component is exactly '..'
                (preDotState === 1 &&
                    startDot === end - 1 &&
                    startDot === startPart + 1)) {
                ret.base = ret.name = path.slice(startPart, end);
            }
            else {
                ret.name = path.slice(startPart, startDot);
                ret.base = path.slice(startPart, end);
                ret.ext = path.slice(startDot, end);
            }
        }
        // If the directory is the root, use the entire root as the `dir` including
        // the trailing slash if any (`C:\abc` -> `C:\`). Otherwise, strip out the
        // trailing slash (`C:\abc\def` -> `C:\abc`).
        if (startPart > 0 && startPart !== rootEnd) {
            ret.dir = path.slice(0, startPart - 1);
        }
        else {
            ret.dir = ret.root;
        }
        return ret;
    },
    sep: '\\',
    delimiter: ';',
    win32: null,
    posix: null
};
const posixCwd = (() => {
    if (platformIsWin32) {
        // Converts Windows' backslash path separators to POSIX forward slashes
        // and truncates any drive indicator
        const regexp = /\\/g;
        return () => {
            const cwd$1 = cwd().replace(regexp, '/');
            return cwd$1.slice(cwd$1.indexOf('/'));
        };
    }
    // We're already on POSIX, no need for any transformations
    return () => cwd();
})();
const posix = {
    // path.resolve([from ...], to)
    resolve(...pathSegments) {
        let resolvedPath = '';
        let resolvedAbsolute = false;
        for (let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            const path = i >= 0 ? pathSegments[i] : posixCwd();
            validateString(path, 'path');
            // Skip empty entries
            if (path.length === 0) {
                continue;
            }
            resolvedPath = `${path}/${resolvedPath}`;
            resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        // Normalize the path
        resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, '/', isPosixPathSeparator);
        if (resolvedAbsolute) {
            return `/${resolvedPath}`;
        }
        return resolvedPath.length > 0 ? resolvedPath : '.';
    },
    normalize(path) {
        validateString(path, 'path');
        if (path.length === 0) {
            return '.';
        }
        const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
        const trailingSeparator = path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;
        // Normalize the path
        path = normalizeString(path, !isAbsolute, '/', isPosixPathSeparator);
        if (path.length === 0) {
            if (isAbsolute) {
                return '/';
            }
            return trailingSeparator ? './' : '.';
        }
        if (trailingSeparator) {
            path += '/';
        }
        return isAbsolute ? `/${path}` : path;
    },
    isAbsolute(path) {
        validateString(path, 'path');
        return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    },
    join(...paths) {
        if (paths.length === 0) {
            return '.';
        }
        let joined;
        for (let i = 0; i < paths.length; ++i) {
            const arg = paths[i];
            validateString(arg, 'path');
            if (arg.length > 0) {
                if (joined === undefined) {
                    joined = arg;
                }
                else {
                    joined += `/${arg}`;
                }
            }
        }
        if (joined === undefined) {
            return '.';
        }
        return posix.normalize(joined);
    },
    relative(from, to) {
        validateString(from, 'from');
        validateString(to, 'to');
        if (from === to) {
            return '';
        }
        // Trim leading forward slashes.
        from = posix.resolve(from);
        to = posix.resolve(to);
        if (from === to) {
            return '';
        }
        const fromStart = 1;
        const fromEnd = from.length;
        const fromLen = fromEnd - fromStart;
        const toStart = 1;
        const toLen = to.length - toStart;
        // Compare paths to find the longest common path from root
        const length = (fromLen < toLen ? fromLen : toLen);
        let lastCommonSep = -1;
        let i = 0;
        for (; i < length; i++) {
            const fromCode = from.charCodeAt(fromStart + i);
            if (fromCode !== to.charCodeAt(toStart + i)) {
                break;
            }
            else if (fromCode === CHAR_FORWARD_SLASH) {
                lastCommonSep = i;
            }
        }
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === CHAR_FORWARD_SLASH) {
                    // We get here if `from` is the exact base path for `to`.
                    // For example: from='/foo/bar'; to='/foo/bar/baz'
                    return to.slice(toStart + i + 1);
                }
                if (i === 0) {
                    // We get here if `from` is the root
                    // For example: from='/'; to='/foo'
                    return to.slice(toStart + i);
                }
            }
            else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === CHAR_FORWARD_SLASH) {
                    // We get here if `to` is the exact base path for `from`.
                    // For example: from='/foo/bar/baz'; to='/foo/bar'
                    lastCommonSep = i;
                }
                else if (i === 0) {
                    // We get here if `to` is the root.
                    // For example: from='/foo/bar'; to='/'
                    lastCommonSep = 0;
                }
            }
        }
        let out = '';
        // Generate the relative path based on the path difference between `to`
        // and `from`.
        for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
            if (i === fromEnd || from.charCodeAt(i) === CHAR_FORWARD_SLASH) {
                out += out.length === 0 ? '..' : '/..';
            }
        }
        // Lastly, append the rest of the destination (`to`) path that comes after
        // the common path parts.
        return `${out}${to.slice(toStart + lastCommonSep)}`;
    },
    toNamespacedPath(path) {
        // Non-op on posix systems
        return path;
    },
    dirname(path) {
        validateString(path, 'path');
        if (path.length === 0) {
            return '.';
        }
        const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
        let end = -1;
        let matchedSlash = true;
        for (let i = path.length - 1; i >= 1; --i) {
            if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
                if (!matchedSlash) {
                    end = i;
                    break;
                }
            }
            else {
                // We saw the first non-path separator
                matchedSlash = false;
            }
        }
        if (end === -1) {
            return hasRoot ? '/' : '.';
        }
        if (hasRoot && end === 1) {
            return '//';
        }
        return path.slice(0, end);
    },
    basename(path, ext) {
        if (ext !== undefined) {
            validateString(ext, 'ext');
        }
        validateString(path, 'path');
        let start = 0;
        let end = -1;
        let matchedSlash = true;
        let i;
        if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
            if (ext === path) {
                return '';
            }
            let extIdx = ext.length - 1;
            let firstNonSlashEnd = -1;
            for (i = path.length - 1; i >= 0; --i) {
                const code = path.charCodeAt(i);
                if (code === CHAR_FORWARD_SLASH) {
                    // If we reached a path separator that was not part of a set of path
                    // separators at the end of the string, stop now
                    if (!matchedSlash) {
                        start = i + 1;
                        break;
                    }
                }
                else {
                    if (firstNonSlashEnd === -1) {
                        // We saw the first non-path separator, remember this index in case
                        // we need it if the extension ends up not matching
                        matchedSlash = false;
                        firstNonSlashEnd = i + 1;
                    }
                    if (extIdx >= 0) {
                        // Try to match the explicit extension
                        if (code === ext.charCodeAt(extIdx)) {
                            if (--extIdx === -1) {
                                // We matched the extension, so mark this as the end of our path
                                // component
                                end = i;
                            }
                        }
                        else {
                            // Extension does not match, so our result is the entire path
                            // component
                            extIdx = -1;
                            end = firstNonSlashEnd;
                        }
                    }
                }
            }
            if (start === end) {
                end = firstNonSlashEnd;
            }
            else if (end === -1) {
                end = path.length;
            }
            return path.slice(start, end);
        }
        for (i = path.length - 1; i >= 0; --i) {
            if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            }
            else if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // path component
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) {
            return '';
        }
        return path.slice(start, end);
    },
    extname(path) {
        validateString(path, 'path');
        let startDot = -1;
        let startPart = 0;
        let end = -1;
        let matchedSlash = true;
        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;
        for (let i = path.length - 1; i >= 0; --i) {
            const code = path.charCodeAt(i);
            if (code === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }
                continue;
            }
            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }
            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                }
                else if (preDotState !== 1) {
                    preDotState = 1;
                }
            }
            else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }
        if (startDot === -1 ||
            end === -1 ||
            // We saw a non-dot character immediately before the dot
            preDotState === 0 ||
            // The (right-most) trimmed path component is exactly '..'
            (preDotState === 1 &&
                startDot === end - 1 &&
                startDot === startPart + 1)) {
            return '';
        }
        return path.slice(startDot, end);
    },
    format: _format.bind(null, '/'),
    parse(path) {
        validateString(path, 'path');
        const ret = { root: '', dir: '', base: '', ext: '', name: '' };
        if (path.length === 0) {
            return ret;
        }
        const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
        let start;
        if (isAbsolute) {
            ret.root = '/';
            start = 1;
        }
        else {
            start = 0;
        }
        let startDot = -1;
        let startPart = 0;
        let end = -1;
        let matchedSlash = true;
        let i = path.length - 1;
        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;
        // Get non-dir info
        for (; i >= start; --i) {
            const code = path.charCodeAt(i);
            if (code === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }
                continue;
            }
            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }
            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                }
                else if (preDotState !== 1) {
                    preDotState = 1;
                }
            }
            else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }
        if (end !== -1) {
            const start = startPart === 0 && isAbsolute ? 1 : startPart;
            if (startDot === -1 ||
                // We saw a non-dot character immediately before the dot
                preDotState === 0 ||
                // The (right-most) trimmed path component is exactly '..'
                (preDotState === 1 &&
                    startDot === end - 1 &&
                    startDot === startPart + 1)) {
                ret.base = ret.name = path.slice(start, end);
            }
            else {
                ret.name = path.slice(start, startDot);
                ret.base = path.slice(start, end);
                ret.ext = path.slice(startDot, end);
            }
        }
        if (startPart > 0) {
            ret.dir = path.slice(0, startPart - 1);
        }
        else if (isAbsolute) {
            ret.dir = '/';
        }
        return ret;
    },
    sep: '/',
    delimiter: ':',
    win32: null,
    posix: null
};
posix.win32 = win32.win32 = win32;
posix.posix = win32.posix = posix;
(platformIsWin32 ? win32.normalize : posix.normalize);
(platformIsWin32 ? win32.resolve : posix.resolve);
(platformIsWin32 ? win32.relative : posix.relative);
(platformIsWin32 ? win32.dirname : posix.dirname);
(platformIsWin32 ? win32.basename : posix.basename);
(platformIsWin32 ? win32.extname : posix.extname);
(platformIsWin32 ? win32.sep : posix.sep);

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const _schemePattern = /^\w[\w\d+.-]*$/;
const _singleSlashStart = /^\//;
const _doubleSlashStart = /^\/\//;
function _validateUri(ret, _strict) {
    // scheme, must be set
    if (!ret.scheme && _strict) {
        throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${ret.authority}", path: "${ret.path}", query: "${ret.query}", fragment: "${ret.fragment}"}`);
    }
    // scheme, https://tools.ietf.org/html/rfc3986#section-3.1
    // ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
    if (ret.scheme && !_schemePattern.test(ret.scheme)) {
        throw new Error('[UriError]: Scheme contains illegal characters.');
    }
    // path, http://tools.ietf.org/html/rfc3986#section-3.3
    // If a URI contains an authority component, then the path component
    // must either be empty or begin with a slash ("/") character.  If a URI
    // does not contain an authority component, then the path cannot begin
    // with two slash characters ("//").
    if (ret.path) {
        if (ret.authority) {
            if (!_singleSlashStart.test(ret.path)) {
                throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
            }
        }
        else {
            if (_doubleSlashStart.test(ret.path)) {
                throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
            }
        }
    }
}
// for a while we allowed uris *without* schemes and this is the migration
// for them, e.g. an uri without scheme and without strict-mode warns and falls
// back to the file-scheme. that should cause the least carnage and still be a
// clear warning
function _schemeFix(scheme, _strict) {
    if (!scheme && !_strict) {
        return 'file';
    }
    return scheme;
}
// implements a bit of https://tools.ietf.org/html/rfc3986#section-5
function _referenceResolution(scheme, path) {
    // the slash-character is our 'default base' as we don't
    // support constructing URIs relative to other URIs. This
    // also means that we alter and potentially break paths.
    // see https://tools.ietf.org/html/rfc3986#section-5.1.4
    switch (scheme) {
        case 'https':
        case 'http':
        case 'file':
            if (!path) {
                path = _slash;
            }
            else if (path[0] !== _slash) {
                path = _slash + path;
            }
            break;
    }
    return path;
}
const _empty = '';
const _slash = '/';
const _regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
/**
 * Uniform Resource Identifier (URI) http://tools.ietf.org/html/rfc3986.
 * This class is a simple parser which creates the basic component parts
 * (http://tools.ietf.org/html/rfc3986#section-3) with minimal validation
 * and encoding.
 *
 * ```txt
 *       foo://example.com:8042/over/there?name=ferret#nose
 *       \_/   \______________/\_________/ \_________/ \__/
 *        |           |            |            |        |
 *     scheme     authority       path        query   fragment
 *        |   _____________________|__
 *       / \ /                        \
 *       urn:example:animal:ferret:nose
 * ```
 */
class URI {
    static isUri(thing) {
        if (thing instanceof URI) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return typeof thing.authority === 'string'
            && typeof thing.fragment === 'string'
            && typeof thing.path === 'string'
            && typeof thing.query === 'string'
            && typeof thing.scheme === 'string'
            && typeof thing.fsPath === 'string'
            && typeof thing.with === 'function'
            && typeof thing.toString === 'function';
    }
    /**
     * @internal
     */
    constructor(schemeOrData, authority, path, query, fragment, _strict = false) {
        if (typeof schemeOrData === 'object') {
            this.scheme = schemeOrData.scheme || _empty;
            this.authority = schemeOrData.authority || _empty;
            this.path = schemeOrData.path || _empty;
            this.query = schemeOrData.query || _empty;
            this.fragment = schemeOrData.fragment || _empty;
            // no validation because it's this URI
            // that creates uri components.
            // _validateUri(this);
        }
        else {
            this.scheme = _schemeFix(schemeOrData, _strict);
            this.authority = authority || _empty;
            this.path = _referenceResolution(this.scheme, path || _empty);
            this.query = query || _empty;
            this.fragment = fragment || _empty;
            _validateUri(this, _strict);
        }
    }
    // ---- filesystem path -----------------------
    /**
     * Returns a string representing the corresponding file system path of this URI.
     * Will handle UNC paths, normalizes windows drive letters to lower-case, and uses the
     * platform specific path separator.
     *
     * * Will *not* validate the path for invalid characters and semantics.
     * * Will *not* look at the scheme of this URI.
     * * The result shall *not* be used for display purposes but for accessing a file on disk.
     *
     *
     * The *difference* to `URI#path` is the use of the platform specific separator and the handling
     * of UNC paths. See the below sample of a file-uri with an authority (UNC path).
     *
     * ```ts
        const u = URI.parse('file://server/c$/folder/file.txt')
        u.authority === 'server'
        u.path === '/shares/c$/file.txt'
        u.fsPath === '\\server\c$\folder\file.txt'
    ```
     *
     * Using `URI#path` to read a file (using fs-apis) would not be enough because parts of the path,
     * namely the server name, would be missing. Therefore `URI#fsPath` exists - it's sugar to ease working
     * with URIs that represent files on disk (`file` scheme).
     */
    get fsPath() {
        // if (this.scheme !== 'file') {
        // 	console.warn(`[UriError] calling fsPath with scheme ${this.scheme}`);
        // }
        return uriToFsPath(this, false);
    }
    // ---- modify to new -------------------------
    with(change) {
        if (!change) {
            return this;
        }
        let { scheme, authority, path, query, fragment } = change;
        if (scheme === undefined) {
            scheme = this.scheme;
        }
        else if (scheme === null) {
            scheme = _empty;
        }
        if (authority === undefined) {
            authority = this.authority;
        }
        else if (authority === null) {
            authority = _empty;
        }
        if (path === undefined) {
            path = this.path;
        }
        else if (path === null) {
            path = _empty;
        }
        if (query === undefined) {
            query = this.query;
        }
        else if (query === null) {
            query = _empty;
        }
        if (fragment === undefined) {
            fragment = this.fragment;
        }
        else if (fragment === null) {
            fragment = _empty;
        }
        if (scheme === this.scheme
            && authority === this.authority
            && path === this.path
            && query === this.query
            && fragment === this.fragment) {
            return this;
        }
        return new Uri(scheme, authority, path, query, fragment);
    }
    // ---- parse & validate ------------------------
    /**
     * Creates a new URI from a string, e.g. `http://www.example.com/some/path`,
     * `file:///usr/home`, or `scheme:with/path`.
     *
     * @param value A string which represents an URI (see `URI#toString`).
     */
    static parse(value, _strict = false) {
        const match = _regexp.exec(value);
        if (!match) {
            return new Uri(_empty, _empty, _empty, _empty, _empty);
        }
        return new Uri(match[2] || _empty, percentDecode(match[4] || _empty), percentDecode(match[5] || _empty), percentDecode(match[7] || _empty), percentDecode(match[9] || _empty), _strict);
    }
    /**
     * Creates a new URI from a file system path, e.g. `c:\my\files`,
     * `/usr/home`, or `\\server\share\some\path`.
     *
     * The *difference* between `URI#parse` and `URI#file` is that the latter treats the argument
     * as path, not as stringified-uri. E.g. `URI.file(path)` is **not the same as**
     * `URI.parse('file://' + path)` because the path might contain characters that are
     * interpreted (# and ?). See the following sample:
     * ```ts
    const good = URI.file('/coding/c#/project1');
    good.scheme === 'file';
    good.path === '/coding/c#/project1';
    good.fragment === '';
    const bad = URI.parse('file://' + '/coding/c#/project1');
    bad.scheme === 'file';
    bad.path === '/coding/c'; // path is now broken
    bad.fragment === '/project1';
    ```
     *
     * @param path A file system path (see `URI#fsPath`)
     */
    static file(path) {
        let authority = _empty;
        // normalize to fwd-slashes on windows,
        // on other systems bwd-slashes are valid
        // filename character, eg /f\oo/ba\r.txt
        if (isWindows) {
            path = path.replace(/\\/g, _slash);
        }
        // check for authority as used in UNC shares
        // or use the path as given
        if (path[0] === _slash && path[1] === _slash) {
            const idx = path.indexOf(_slash, 2);
            if (idx === -1) {
                authority = path.substring(2);
                path = _slash;
            }
            else {
                authority = path.substring(2, idx);
                path = path.substring(idx) || _slash;
            }
        }
        return new Uri('file', authority, path, _empty, _empty);
    }
    /**
     * Creates new URI from uri components.
     *
     * Unless `strict` is `true` the scheme is defaults to be `file`. This function performs
     * validation and should be used for untrusted uri components retrieved from storage,
     * user input, command arguments etc
     */
    static from(components, strict) {
        const result = new Uri(components.scheme, components.authority, components.path, components.query, components.fragment, strict);
        return result;
    }
    /**
     * Join a URI path with path fragments and normalizes the resulting path.
     *
     * @param uri The input URI.
     * @param pathFragment The path fragment to add to the URI path.
     * @returns The resulting URI.
     */
    static joinPath(uri, ...pathFragment) {
        if (!uri.path) {
            throw new Error(`[UriError]: cannot call joinPath on URI without path`);
        }
        let newPath;
        if (isWindows && uri.scheme === 'file') {
            newPath = URI.file(win32.join(uriToFsPath(uri, true), ...pathFragment)).path;
        }
        else {
            newPath = posix.join(uri.path, ...pathFragment);
        }
        return uri.with({ path: newPath });
    }
    // ---- printing/externalize ---------------------------
    /**
     * Creates a string representation for this URI. It's guaranteed that calling
     * `URI.parse` with the result of this function creates an URI which is equal
     * to this URI.
     *
     * * The result shall *not* be used for display purposes but for externalization or transport.
     * * The result will be encoded using the percentage encoding and encoding happens mostly
     * ignore the scheme-specific encoding rules.
     *
     * @param skipEncoding Do not encode the result, default is `false`
     */
    toString(skipEncoding = false) {
        return _asFormatted(this, skipEncoding);
    }
    toJSON() {
        return this;
    }
    static revive(data) {
        var _a, _b;
        if (!data) {
            return data;
        }
        else if (data instanceof URI) {
            return data;
        }
        else {
            const result = new Uri(data);
            result._formatted = (_a = data.external) !== null && _a !== void 0 ? _a : null;
            result._fsPath = data._sep === _pathSepMarker ? (_b = data.fsPath) !== null && _b !== void 0 ? _b : null : null;
            return result;
        }
    }
}
const _pathSepMarker = isWindows ? 1 : undefined;
// This class exists so that URI is compatible with vscode.Uri (API).
class Uri extends URI {
    constructor() {
        super(...arguments);
        this._formatted = null;
        this._fsPath = null;
    }
    get fsPath() {
        if (!this._fsPath) {
            this._fsPath = uriToFsPath(this, false);
        }
        return this._fsPath;
    }
    toString(skipEncoding = false) {
        if (!skipEncoding) {
            if (!this._formatted) {
                this._formatted = _asFormatted(this, false);
            }
            return this._formatted;
        }
        else {
            // we don't cache that
            return _asFormatted(this, true);
        }
    }
    toJSON() {
        const res = {
            $mid: 1 /* MarshalledId.Uri */
        };
        // cached state
        if (this._fsPath) {
            res.fsPath = this._fsPath;
            res._sep = _pathSepMarker;
        }
        if (this._formatted) {
            res.external = this._formatted;
        }
        //--- uri components
        if (this.path) {
            res.path = this.path;
        }
        // TODO
        // this isn't correct and can violate the UriComponents contract but
        // this is part of the vscode.Uri API and we shouldn't change how that
        // works anymore
        if (this.scheme) {
            res.scheme = this.scheme;
        }
        if (this.authority) {
            res.authority = this.authority;
        }
        if (this.query) {
            res.query = this.query;
        }
        if (this.fragment) {
            res.fragment = this.fragment;
        }
        return res;
    }
}
// reserved characters: https://tools.ietf.org/html/rfc3986#section-2.2
const encodeTable = {
    [58 /* CharCode.Colon */]: '%3A', // gen-delims
    [47 /* CharCode.Slash */]: '%2F',
    [63 /* CharCode.QuestionMark */]: '%3F',
    [35 /* CharCode.Hash */]: '%23',
    [91 /* CharCode.OpenSquareBracket */]: '%5B',
    [93 /* CharCode.CloseSquareBracket */]: '%5D',
    [64 /* CharCode.AtSign */]: '%40',
    [33 /* CharCode.ExclamationMark */]: '%21', // sub-delims
    [36 /* CharCode.DollarSign */]: '%24',
    [38 /* CharCode.Ampersand */]: '%26',
    [39 /* CharCode.SingleQuote */]: '%27',
    [40 /* CharCode.OpenParen */]: '%28',
    [41 /* CharCode.CloseParen */]: '%29',
    [42 /* CharCode.Asterisk */]: '%2A',
    [43 /* CharCode.Plus */]: '%2B',
    [44 /* CharCode.Comma */]: '%2C',
    [59 /* CharCode.Semicolon */]: '%3B',
    [61 /* CharCode.Equals */]: '%3D',
    [32 /* CharCode.Space */]: '%20',
};
function encodeURIComponentFast(uriComponent, isPath, isAuthority) {
    let res = undefined;
    let nativeEncodePos = -1;
    for (let pos = 0; pos < uriComponent.length; pos++) {
        const code = uriComponent.charCodeAt(pos);
        // unreserved characters: https://tools.ietf.org/html/rfc3986#section-2.3
        if ((code >= 97 /* CharCode.a */ && code <= 122 /* CharCode.z */)
            || (code >= 65 /* CharCode.A */ && code <= 90 /* CharCode.Z */)
            || (code >= 48 /* CharCode.Digit0 */ && code <= 57 /* CharCode.Digit9 */)
            || code === 45 /* CharCode.Dash */
            || code === 46 /* CharCode.Period */
            || code === 95 /* CharCode.Underline */
            || code === 126 /* CharCode.Tilde */
            || (isPath && code === 47 /* CharCode.Slash */)
            || (isAuthority && code === 91 /* CharCode.OpenSquareBracket */)
            || (isAuthority && code === 93 /* CharCode.CloseSquareBracket */)
            || (isAuthority && code === 58 /* CharCode.Colon */)) {
            // check if we are delaying native encode
            if (nativeEncodePos !== -1) {
                res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
                nativeEncodePos = -1;
            }
            // check if we write into a new string (by default we try to return the param)
            if (res !== undefined) {
                res += uriComponent.charAt(pos);
            }
        }
        else {
            // encoding needed, we need to allocate a new string
            if (res === undefined) {
                res = uriComponent.substr(0, pos);
            }
            // check with default table first
            const escaped = encodeTable[code];
            if (escaped !== undefined) {
                // check if we are delaying native encode
                if (nativeEncodePos !== -1) {
                    res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
                    nativeEncodePos = -1;
                }
                // append escaped variant to result
                res += escaped;
            }
            else if (nativeEncodePos === -1) {
                // use native encode only when needed
                nativeEncodePos = pos;
            }
        }
    }
    if (nativeEncodePos !== -1) {
        res += encodeURIComponent(uriComponent.substring(nativeEncodePos));
    }
    return res !== undefined ? res : uriComponent;
}
function encodeURIComponentMinimal(path) {
    let res = undefined;
    for (let pos = 0; pos < path.length; pos++) {
        const code = path.charCodeAt(pos);
        if (code === 35 /* CharCode.Hash */ || code === 63 /* CharCode.QuestionMark */) {
            if (res === undefined) {
                res = path.substr(0, pos);
            }
            res += encodeTable[code];
        }
        else {
            if (res !== undefined) {
                res += path[pos];
            }
        }
    }
    return res !== undefined ? res : path;
}
/**
 * Compute `fsPath` for the given uri
 */
function uriToFsPath(uri, keepDriveLetterCasing) {
    let value;
    if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
        // unc path: file://shares/c$/far/boo
        value = `//${uri.authority}${uri.path}`;
    }
    else if (uri.path.charCodeAt(0) === 47 /* CharCode.Slash */
        && (uri.path.charCodeAt(1) >= 65 /* CharCode.A */ && uri.path.charCodeAt(1) <= 90 /* CharCode.Z */ || uri.path.charCodeAt(1) >= 97 /* CharCode.a */ && uri.path.charCodeAt(1) <= 122 /* CharCode.z */)
        && uri.path.charCodeAt(2) === 58 /* CharCode.Colon */) {
        if (!keepDriveLetterCasing) {
            // windows drive letter: file:///c:/far/boo
            value = uri.path[1].toLowerCase() + uri.path.substr(2);
        }
        else {
            value = uri.path.substr(1);
        }
    }
    else {
        // other path
        value = uri.path;
    }
    if (isWindows) {
        value = value.replace(/\//g, '\\');
    }
    return value;
}
/**
 * Create the external version of a uri
 */
function _asFormatted(uri, skipEncoding) {
    const encoder = !skipEncoding
        ? encodeURIComponentFast
        : encodeURIComponentMinimal;
    let res = '';
    let { scheme, authority, path, query, fragment } = uri;
    if (scheme) {
        res += scheme;
        res += ':';
    }
    if (authority || scheme === 'file') {
        res += _slash;
        res += _slash;
    }
    if (authority) {
        let idx = authority.indexOf('@');
        if (idx !== -1) {
            // <user>@<auth>
            const userinfo = authority.substr(0, idx);
            authority = authority.substr(idx + 1);
            idx = userinfo.lastIndexOf(':');
            if (idx === -1) {
                res += encoder(userinfo, false, false);
            }
            else {
                // <user>:<pass>@<auth>
                res += encoder(userinfo.substr(0, idx), false, false);
                res += ':';
                res += encoder(userinfo.substr(idx + 1), false, true);
            }
            res += '@';
        }
        authority = authority.toLowerCase();
        idx = authority.lastIndexOf(':');
        if (idx === -1) {
            res += encoder(authority, false, true);
        }
        else {
            // <auth>:<port>
            res += encoder(authority.substr(0, idx), false, true);
            res += authority.substr(idx);
        }
    }
    if (path) {
        // lower-case windows drive letters in /C:/fff or C:/fff
        if (path.length >= 3 && path.charCodeAt(0) === 47 /* CharCode.Slash */ && path.charCodeAt(2) === 58 /* CharCode.Colon */) {
            const code = path.charCodeAt(1);
            if (code >= 65 /* CharCode.A */ && code <= 90 /* CharCode.Z */) {
                path = `/${String.fromCharCode(code + 32)}:${path.substr(3)}`; // "/c:".length === 3
            }
        }
        else if (path.length >= 2 && path.charCodeAt(1) === 58 /* CharCode.Colon */) {
            const code = path.charCodeAt(0);
            if (code >= 65 /* CharCode.A */ && code <= 90 /* CharCode.Z */) {
                path = `${String.fromCharCode(code + 32)}:${path.substr(2)}`; // "/c:".length === 3
            }
        }
        // encode the rest of the path
        res += encoder(path, true, false);
    }
    if (query) {
        res += '?';
        res += encoder(query, false, false);
    }
    if (fragment) {
        res += '#';
        res += !skipEncoding ? encodeURIComponentFast(fragment, false, false) : fragment;
    }
    return res;
}
// --- decode
function decodeURIComponentGraceful(str) {
    try {
        return decodeURIComponent(str);
    }
    catch (_a) {
        if (str.length > 3) {
            return str.substr(0, 3) + decodeURIComponentGraceful(str.substr(3));
        }
        else {
            return str;
        }
    }
}
const _rEncodedAsHex = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
function percentDecode(str) {
    if (!str.match(_rEncodedAsHex)) {
        return str;
    }
    return str.replace(_rEncodedAsHex, (match) => decodeURIComponentGraceful(match));
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A position in the editor.
 */
class Position {
    constructor(lineNumber, column) {
        this.lineNumber = lineNumber;
        this.column = column;
    }
    /**
     * Create a new position from this position.
     *
     * @param newLineNumber new line number
     * @param newColumn new column
     */
    with(newLineNumber = this.lineNumber, newColumn = this.column) {
        if (newLineNumber === this.lineNumber && newColumn === this.column) {
            return this;
        }
        else {
            return new Position(newLineNumber, newColumn);
        }
    }
    /**
     * Derive a new position from this position.
     *
     * @param deltaLineNumber line number delta
     * @param deltaColumn column delta
     */
    delta(deltaLineNumber = 0, deltaColumn = 0) {
        return this.with(this.lineNumber + deltaLineNumber, this.column + deltaColumn);
    }
    /**
     * Test if this position equals other position
     */
    equals(other) {
        return Position.equals(this, other);
    }
    /**
     * Test if position `a` equals position `b`
     */
    static equals(a, b) {
        if (!a && !b) {
            return true;
        }
        return (!!a &&
            !!b &&
            a.lineNumber === b.lineNumber &&
            a.column === b.column);
    }
    /**
     * Test if this position is before other position.
     * If the two positions are equal, the result will be false.
     */
    isBefore(other) {
        return Position.isBefore(this, other);
    }
    /**
     * Test if position `a` is before position `b`.
     * If the two positions are equal, the result will be false.
     */
    static isBefore(a, b) {
        if (a.lineNumber < b.lineNumber) {
            return true;
        }
        if (b.lineNumber < a.lineNumber) {
            return false;
        }
        return a.column < b.column;
    }
    /**
     * Test if this position is before other position.
     * If the two positions are equal, the result will be true.
     */
    isBeforeOrEqual(other) {
        return Position.isBeforeOrEqual(this, other);
    }
    /**
     * Test if position `a` is before position `b`.
     * If the two positions are equal, the result will be true.
     */
    static isBeforeOrEqual(a, b) {
        if (a.lineNumber < b.lineNumber) {
            return true;
        }
        if (b.lineNumber < a.lineNumber) {
            return false;
        }
        return a.column <= b.column;
    }
    /**
     * A function that compares positions, useful for sorting
     */
    static compare(a, b) {
        const aLineNumber = a.lineNumber | 0;
        const bLineNumber = b.lineNumber | 0;
        if (aLineNumber === bLineNumber) {
            const aColumn = a.column | 0;
            const bColumn = b.column | 0;
            return aColumn - bColumn;
        }
        return aLineNumber - bLineNumber;
    }
    /**
     * Clone this position.
     */
    clone() {
        return new Position(this.lineNumber, this.column);
    }
    /**
     * Convert to a human-readable representation.
     */
    toString() {
        return '(' + this.lineNumber + ',' + this.column + ')';
    }
    // ---
    /**
     * Create a `Position` from an `IPosition`.
     */
    static lift(pos) {
        return new Position(pos.lineNumber, pos.column);
    }
    /**
     * Test if `obj` is an `IPosition`.
     */
    static isIPosition(obj) {
        return (obj
            && (typeof obj.lineNumber === 'number')
            && (typeof obj.column === 'number'));
    }
    toJSON() {
        return {
            lineNumber: this.lineNumber,
            column: this.column
        };
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A range in the editor. (startLineNumber,startColumn) is <= (endLineNumber,endColumn)
 */
class Range {
    constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        if ((startLineNumber > endLineNumber) || (startLineNumber === endLineNumber && startColumn > endColumn)) {
            this.startLineNumber = endLineNumber;
            this.startColumn = endColumn;
            this.endLineNumber = startLineNumber;
            this.endColumn = startColumn;
        }
        else {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
        }
    }
    /**
     * Test if this range is empty.
     */
    isEmpty() {
        return Range.isEmpty(this);
    }
    /**
     * Test if `range` is empty.
     */
    static isEmpty(range) {
        return (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn);
    }
    /**
     * Test if position is in this range. If the position is at the edges, will return true.
     */
    containsPosition(position) {
        return Range.containsPosition(this, position);
    }
    /**
     * Test if `position` is in `range`. If the position is at the edges, will return true.
     */
    static containsPosition(range, position) {
        if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
            return false;
        }
        if (position.lineNumber === range.startLineNumber && position.column < range.startColumn) {
            return false;
        }
        if (position.lineNumber === range.endLineNumber && position.column > range.endColumn) {
            return false;
        }
        return true;
    }
    /**
     * Test if `position` is in `range`. If the position is at the edges, will return false.
     * @internal
     */
    static strictContainsPosition(range, position) {
        if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
            return false;
        }
        if (position.lineNumber === range.startLineNumber && position.column <= range.startColumn) {
            return false;
        }
        if (position.lineNumber === range.endLineNumber && position.column >= range.endColumn) {
            return false;
        }
        return true;
    }
    /**
     * Test if range is in this range. If the range is equal to this range, will return true.
     */
    containsRange(range) {
        return Range.containsRange(this, range);
    }
    /**
     * Test if `otherRange` is in `range`. If the ranges are equal, will return true.
     */
    static containsRange(range, otherRange) {
        if (otherRange.startLineNumber < range.startLineNumber || otherRange.endLineNumber < range.startLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber > range.endLineNumber || otherRange.endLineNumber > range.endLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber === range.startLineNumber && otherRange.startColumn < range.startColumn) {
            return false;
        }
        if (otherRange.endLineNumber === range.endLineNumber && otherRange.endColumn > range.endColumn) {
            return false;
        }
        return true;
    }
    /**
     * Test if `range` is strictly in this range. `range` must start after and end before this range for the result to be true.
     */
    strictContainsRange(range) {
        return Range.strictContainsRange(this, range);
    }
    /**
     * Test if `otherRange` is strictly in `range` (must start after, and end before). If the ranges are equal, will return false.
     */
    static strictContainsRange(range, otherRange) {
        if (otherRange.startLineNumber < range.startLineNumber || otherRange.endLineNumber < range.startLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber > range.endLineNumber || otherRange.endLineNumber > range.endLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber === range.startLineNumber && otherRange.startColumn <= range.startColumn) {
            return false;
        }
        if (otherRange.endLineNumber === range.endLineNumber && otherRange.endColumn >= range.endColumn) {
            return false;
        }
        return true;
    }
    /**
     * A reunion of the two ranges.
     * The smallest position will be used as the start point, and the largest one as the end point.
     */
    plusRange(range) {
        return Range.plusRange(this, range);
    }
    /**
     * A reunion of the two ranges.
     * The smallest position will be used as the start point, and the largest one as the end point.
     */
    static plusRange(a, b) {
        let startLineNumber;
        let startColumn;
        let endLineNumber;
        let endColumn;
        if (b.startLineNumber < a.startLineNumber) {
            startLineNumber = b.startLineNumber;
            startColumn = b.startColumn;
        }
        else if (b.startLineNumber === a.startLineNumber) {
            startLineNumber = b.startLineNumber;
            startColumn = Math.min(b.startColumn, a.startColumn);
        }
        else {
            startLineNumber = a.startLineNumber;
            startColumn = a.startColumn;
        }
        if (b.endLineNumber > a.endLineNumber) {
            endLineNumber = b.endLineNumber;
            endColumn = b.endColumn;
        }
        else if (b.endLineNumber === a.endLineNumber) {
            endLineNumber = b.endLineNumber;
            endColumn = Math.max(b.endColumn, a.endColumn);
        }
        else {
            endLineNumber = a.endLineNumber;
            endColumn = a.endColumn;
        }
        return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
    }
    /**
     * A intersection of the two ranges.
     */
    intersectRanges(range) {
        return Range.intersectRanges(this, range);
    }
    /**
     * A intersection of the two ranges.
     */
    static intersectRanges(a, b) {
        let resultStartLineNumber = a.startLineNumber;
        let resultStartColumn = a.startColumn;
        let resultEndLineNumber = a.endLineNumber;
        let resultEndColumn = a.endColumn;
        const otherStartLineNumber = b.startLineNumber;
        const otherStartColumn = b.startColumn;
        const otherEndLineNumber = b.endLineNumber;
        const otherEndColumn = b.endColumn;
        if (resultStartLineNumber < otherStartLineNumber) {
            resultStartLineNumber = otherStartLineNumber;
            resultStartColumn = otherStartColumn;
        }
        else if (resultStartLineNumber === otherStartLineNumber) {
            resultStartColumn = Math.max(resultStartColumn, otherStartColumn);
        }
        if (resultEndLineNumber > otherEndLineNumber) {
            resultEndLineNumber = otherEndLineNumber;
            resultEndColumn = otherEndColumn;
        }
        else if (resultEndLineNumber === otherEndLineNumber) {
            resultEndColumn = Math.min(resultEndColumn, otherEndColumn);
        }
        // Check if selection is now empty
        if (resultStartLineNumber > resultEndLineNumber) {
            return null;
        }
        if (resultStartLineNumber === resultEndLineNumber && resultStartColumn > resultEndColumn) {
            return null;
        }
        return new Range(resultStartLineNumber, resultStartColumn, resultEndLineNumber, resultEndColumn);
    }
    /**
     * Test if this range equals other.
     */
    equalsRange(other) {
        return Range.equalsRange(this, other);
    }
    /**
     * Test if range `a` equals `b`.
     */
    static equalsRange(a, b) {
        if (!a && !b) {
            return true;
        }
        return (!!a &&
            !!b &&
            a.startLineNumber === b.startLineNumber &&
            a.startColumn === b.startColumn &&
            a.endLineNumber === b.endLineNumber &&
            a.endColumn === b.endColumn);
    }
    /**
     * Return the end position (which will be after or equal to the start position)
     */
    getEndPosition() {
        return Range.getEndPosition(this);
    }
    /**
     * Return the end position (which will be after or equal to the start position)
     */
    static getEndPosition(range) {
        return new Position(range.endLineNumber, range.endColumn);
    }
    /**
     * Return the start position (which will be before or equal to the end position)
     */
    getStartPosition() {
        return Range.getStartPosition(this);
    }
    /**
     * Return the start position (which will be before or equal to the end position)
     */
    static getStartPosition(range) {
        return new Position(range.startLineNumber, range.startColumn);
    }
    /**
     * Transform to a user presentable string representation.
     */
    toString() {
        return '[' + this.startLineNumber + ',' + this.startColumn + ' -> ' + this.endLineNumber + ',' + this.endColumn + ']';
    }
    /**
     * Create a new range using this range's start position, and using endLineNumber and endColumn as the end position.
     */
    setEndPosition(endLineNumber, endColumn) {
        return new Range(this.startLineNumber, this.startColumn, endLineNumber, endColumn);
    }
    /**
     * Create a new range using this range's end position, and using startLineNumber and startColumn as the start position.
     */
    setStartPosition(startLineNumber, startColumn) {
        return new Range(startLineNumber, startColumn, this.endLineNumber, this.endColumn);
    }
    /**
     * Create a new empty range using this range's start position.
     */
    collapseToStart() {
        return Range.collapseToStart(this);
    }
    /**
     * Create a new empty range using this range's start position.
     */
    static collapseToStart(range) {
        return new Range(range.startLineNumber, range.startColumn, range.startLineNumber, range.startColumn);
    }
    /**
     * Create a new empty range using this range's end position.
     */
    collapseToEnd() {
        return Range.collapseToEnd(this);
    }
    /**
     * Create a new empty range using this range's end position.
     */
    static collapseToEnd(range) {
        return new Range(range.endLineNumber, range.endColumn, range.endLineNumber, range.endColumn);
    }
    /**
     * Moves the range by the given amount of lines.
     */
    delta(lineCount) {
        return new Range(this.startLineNumber + lineCount, this.startColumn, this.endLineNumber + lineCount, this.endColumn);
    }
    // ---
    static fromPositions(start, end = start) {
        return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    }
    static lift(range) {
        if (!range) {
            return null;
        }
        return new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
    }
    /**
     * Test if `obj` is an `IRange`.
     */
    static isIRange(obj) {
        return (obj
            && (typeof obj.startLineNumber === 'number')
            && (typeof obj.startColumn === 'number')
            && (typeof obj.endLineNumber === 'number')
            && (typeof obj.endColumn === 'number'));
    }
    /**
     * Test if the two ranges are touching in any way.
     */
    static areIntersectingOrTouching(a, b) {
        // Check if `a` is before `b`
        if (a.endLineNumber < b.startLineNumber || (a.endLineNumber === b.startLineNumber && a.endColumn < b.startColumn)) {
            return false;
        }
        // Check if `b` is before `a`
        if (b.endLineNumber < a.startLineNumber || (b.endLineNumber === a.startLineNumber && b.endColumn < a.startColumn)) {
            return false;
        }
        // These ranges must intersect
        return true;
    }
    /**
     * Test if the two ranges are intersecting. If the ranges are touching it returns true.
     */
    static areIntersecting(a, b) {
        // Check if `a` is before `b`
        if (a.endLineNumber < b.startLineNumber || (a.endLineNumber === b.startLineNumber && a.endColumn <= b.startColumn)) {
            return false;
        }
        // Check if `b` is before `a`
        if (b.endLineNumber < a.startLineNumber || (b.endLineNumber === a.startLineNumber && b.endColumn <= a.startColumn)) {
            return false;
        }
        // These ranges must intersect
        return true;
    }
    /**
     * A function that compares ranges, useful for sorting ranges
     * It will first compare ranges on the startPosition and then on the endPosition
     */
    static compareRangesUsingStarts(a, b) {
        if (a && b) {
            const aStartLineNumber = a.startLineNumber | 0;
            const bStartLineNumber = b.startLineNumber | 0;
            if (aStartLineNumber === bStartLineNumber) {
                const aStartColumn = a.startColumn | 0;
                const bStartColumn = b.startColumn | 0;
                if (aStartColumn === bStartColumn) {
                    const aEndLineNumber = a.endLineNumber | 0;
                    const bEndLineNumber = b.endLineNumber | 0;
                    if (aEndLineNumber === bEndLineNumber) {
                        const aEndColumn = a.endColumn | 0;
                        const bEndColumn = b.endColumn | 0;
                        return aEndColumn - bEndColumn;
                    }
                    return aEndLineNumber - bEndLineNumber;
                }
                return aStartColumn - bStartColumn;
            }
            return aStartLineNumber - bStartLineNumber;
        }
        const aExists = (a ? 1 : 0);
        const bExists = (b ? 1 : 0);
        return aExists - bExists;
    }
    /**
     * A function that compares ranges, useful for sorting ranges
     * It will first compare ranges on the endPosition and then on the startPosition
     */
    static compareRangesUsingEnds(a, b) {
        if (a.endLineNumber === b.endLineNumber) {
            if (a.endColumn === b.endColumn) {
                if (a.startLineNumber === b.startLineNumber) {
                    return a.startColumn - b.startColumn;
                }
                return a.startLineNumber - b.startLineNumber;
            }
            return a.endColumn - b.endColumn;
        }
        return a.endLineNumber - b.endLineNumber;
    }
    /**
     * Test if the range spans multiple lines.
     */
    static spansMultipleLines(range) {
        return range.endLineNumber > range.startLineNumber;
    }
    toJSON() {
        return this;
    }
}

/**
 * Returns the last element of an array.
 * @param array The array.
 * @param n Which element from the end (default is zero).
 */
function equals(one, other, itemEquals = (a, b) => a === b) {
    if (one === other) {
        return true;
    }
    if (!one || !other) {
        return false;
    }
    if (one.length !== other.length) {
        return false;
    }
    for (let i = 0, len = one.length; i < len; i++) {
        if (!itemEquals(one[i], other[i])) {
            return false;
        }
    }
    return true;
}
/**
 * Splits the given items into a list of (non-empty) groups.
 * `shouldBeGrouped` is used to decide if two consecutive items should be in the same group.
 * The order of the items is preserved.
 */
function* groupAdjacentBy(items, shouldBeGrouped) {
    let currentGroup;
    let last;
    for (const item of items) {
        if (last !== undefined && shouldBeGrouped(last, item)) {
            currentGroup.push(item);
        }
        else {
            if (currentGroup) {
                yield currentGroup;
            }
            currentGroup = [item];
        }
        last = item;
    }
    if (currentGroup) {
        yield currentGroup;
    }
}
function forEachAdjacent(arr, f) {
    for (let i = 0; i <= arr.length; i++) {
        f(i === 0 ? undefined : arr[i - 1], i === arr.length ? undefined : arr[i]);
    }
}
function forEachWithNeighbors(arr, f) {
    for (let i = 0; i < arr.length; i++) {
        f(i === 0 ? undefined : arr[i - 1], arr[i], i + 1 === arr.length ? undefined : arr[i + 1]);
    }
}
function pushMany(arr, items) {
    for (const item of items) {
        arr.push(item);
    }
}
var CompareResult;
(function (CompareResult) {
    function isLessThan(result) {
        return result < 0;
    }
    CompareResult.isLessThan = isLessThan;
    function isLessThanOrEqual(result) {
        return result <= 0;
    }
    CompareResult.isLessThanOrEqual = isLessThanOrEqual;
    function isGreaterThan(result) {
        return result > 0;
    }
    CompareResult.isGreaterThan = isGreaterThan;
    function isNeitherLessOrGreaterThan(result) {
        return result === 0;
    }
    CompareResult.isNeitherLessOrGreaterThan = isNeitherLessOrGreaterThan;
    CompareResult.greaterThan = 1;
    CompareResult.lessThan = -1;
    CompareResult.neitherLessOrGreaterThan = 0;
})(CompareResult || (CompareResult = {}));
function compareBy(selector, comparator) {
    return (a, b) => comparator(selector(a), selector(b));
}
/**
 * The natural order on numbers.
*/
const numberComparator = (a, b) => a - b;
function reverseOrder(comparator) {
    return (a, b) => -comparator(a, b);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function toUint8(v) {
    if (v < 0) {
        return 0;
    }
    if (v > 255 /* Constants.MAX_UINT_8 */) {
        return 255 /* Constants.MAX_UINT_8 */;
    }
    return v | 0;
}
function toUint32(v) {
    if (v < 0) {
        return 0;
    }
    if (v > 4294967295 /* Constants.MAX_UINT_32 */) {
        return 4294967295 /* Constants.MAX_UINT_32 */;
    }
    return v | 0;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class PrefixSumComputer {
    constructor(values) {
        this.values = values;
        this.prefixSum = new Uint32Array(values.length);
        this.prefixSumValidIndex = new Int32Array(1);
        this.prefixSumValidIndex[0] = -1;
    }
    insertValues(insertIndex, insertValues) {
        insertIndex = toUint32(insertIndex);
        const oldValues = this.values;
        const oldPrefixSum = this.prefixSum;
        const insertValuesLen = insertValues.length;
        if (insertValuesLen === 0) {
            return false;
        }
        this.values = new Uint32Array(oldValues.length + insertValuesLen);
        this.values.set(oldValues.subarray(0, insertIndex), 0);
        this.values.set(oldValues.subarray(insertIndex), insertIndex + insertValuesLen);
        this.values.set(insertValues, insertIndex);
        if (insertIndex - 1 < this.prefixSumValidIndex[0]) {
            this.prefixSumValidIndex[0] = insertIndex - 1;
        }
        this.prefixSum = new Uint32Array(this.values.length);
        if (this.prefixSumValidIndex[0] >= 0) {
            this.prefixSum.set(oldPrefixSum.subarray(0, this.prefixSumValidIndex[0] + 1));
        }
        return true;
    }
    setValue(index, value) {
        index = toUint32(index);
        value = toUint32(value);
        if (this.values[index] === value) {
            return false;
        }
        this.values[index] = value;
        if (index - 1 < this.prefixSumValidIndex[0]) {
            this.prefixSumValidIndex[0] = index - 1;
        }
        return true;
    }
    removeValues(startIndex, count) {
        startIndex = toUint32(startIndex);
        count = toUint32(count);
        const oldValues = this.values;
        const oldPrefixSum = this.prefixSum;
        if (startIndex >= oldValues.length) {
            return false;
        }
        const maxCount = oldValues.length - startIndex;
        if (count >= maxCount) {
            count = maxCount;
        }
        if (count === 0) {
            return false;
        }
        this.values = new Uint32Array(oldValues.length - count);
        this.values.set(oldValues.subarray(0, startIndex), 0);
        this.values.set(oldValues.subarray(startIndex + count), startIndex);
        this.prefixSum = new Uint32Array(this.values.length);
        if (startIndex - 1 < this.prefixSumValidIndex[0]) {
            this.prefixSumValidIndex[0] = startIndex - 1;
        }
        if (this.prefixSumValidIndex[0] >= 0) {
            this.prefixSum.set(oldPrefixSum.subarray(0, this.prefixSumValidIndex[0] + 1));
        }
        return true;
    }
    getTotalSum() {
        if (this.values.length === 0) {
            return 0;
        }
        return this._getPrefixSum(this.values.length - 1);
    }
    /**
     * Returns the sum of the first `index + 1` many items.
     * @returns `SUM(0 <= j <= index, values[j])`.
     */
    getPrefixSum(index) {
        if (index < 0) {
            return 0;
        }
        index = toUint32(index);
        return this._getPrefixSum(index);
    }
    _getPrefixSum(index) {
        if (index <= this.prefixSumValidIndex[0]) {
            return this.prefixSum[index];
        }
        let startIndex = this.prefixSumValidIndex[0] + 1;
        if (startIndex === 0) {
            this.prefixSum[0] = this.values[0];
            startIndex++;
        }
        if (index >= this.values.length) {
            index = this.values.length - 1;
        }
        for (let i = startIndex; i <= index; i++) {
            this.prefixSum[i] = this.prefixSum[i - 1] + this.values[i];
        }
        this.prefixSumValidIndex[0] = Math.max(this.prefixSumValidIndex[0], index);
        return this.prefixSum[index];
    }
    getIndexOf(sum) {
        sum = Math.floor(sum);
        // Compute all sums (to get a fully valid prefixSum)
        this.getTotalSum();
        let low = 0;
        let high = this.values.length - 1;
        let mid = 0;
        let midStop = 0;
        let midStart = 0;
        while (low <= high) {
            mid = low + ((high - low) / 2) | 0;
            midStop = this.prefixSum[mid];
            midStart = midStop - this.values[mid];
            if (sum < midStart) {
                high = mid - 1;
            }
            else if (sum >= midStop) {
                low = mid + 1;
            }
            else {
                break;
            }
        }
        return new PrefixSumIndexOfResult(mid, sum - midStart);
    }
}
class PrefixSumIndexOfResult {
    constructor(index, remainder) {
        this.index = index;
        this.remainder = remainder;
        this._prefixSumIndexOfResultBrand = undefined;
        this.index = index;
        this.remainder = remainder;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class MirrorTextModel {
    constructor(uri, lines, eol, versionId) {
        this._uri = uri;
        this._lines = lines;
        this._eol = eol;
        this._versionId = versionId;
        this._lineStarts = null;
        this._cachedTextValue = null;
    }
    dispose() {
        this._lines.length = 0;
    }
    get version() {
        return this._versionId;
    }
    getText() {
        if (this._cachedTextValue === null) {
            this._cachedTextValue = this._lines.join(this._eol);
        }
        return this._cachedTextValue;
    }
    onEvents(e) {
        if (e.eol && e.eol !== this._eol) {
            this._eol = e.eol;
            this._lineStarts = null;
        }
        // Update my lines
        const changes = e.changes;
        for (const change of changes) {
            this._acceptDeleteRange(change.range);
            this._acceptInsertText(new Position(change.range.startLineNumber, change.range.startColumn), change.text);
        }
        this._versionId = e.versionId;
        this._cachedTextValue = null;
    }
    _ensureLineStarts() {
        if (!this._lineStarts) {
            const eolLength = this._eol.length;
            const linesLength = this._lines.length;
            const lineStartValues = new Uint32Array(linesLength);
            for (let i = 0; i < linesLength; i++) {
                lineStartValues[i] = this._lines[i].length + eolLength;
            }
            this._lineStarts = new PrefixSumComputer(lineStartValues);
        }
    }
    /**
     * All changes to a line's text go through this method
     */
    _setLineText(lineIndex, newValue) {
        this._lines[lineIndex] = newValue;
        if (this._lineStarts) {
            // update prefix sum
            this._lineStarts.setValue(lineIndex, this._lines[lineIndex].length + this._eol.length);
        }
    }
    _acceptDeleteRange(range) {
        if (range.startLineNumber === range.endLineNumber) {
            if (range.startColumn === range.endColumn) {
                // Nothing to delete
                return;
            }
            // Delete text on the affected line
            this._setLineText(range.startLineNumber - 1, this._lines[range.startLineNumber - 1].substring(0, range.startColumn - 1)
                + this._lines[range.startLineNumber - 1].substring(range.endColumn - 1));
            return;
        }
        // Take remaining text on last line and append it to remaining text on first line
        this._setLineText(range.startLineNumber - 1, this._lines[range.startLineNumber - 1].substring(0, range.startColumn - 1)
            + this._lines[range.endLineNumber - 1].substring(range.endColumn - 1));
        // Delete middle lines
        this._lines.splice(range.startLineNumber, range.endLineNumber - range.startLineNumber);
        if (this._lineStarts) {
            // update prefix sum
            this._lineStarts.removeValues(range.startLineNumber, range.endLineNumber - range.startLineNumber);
        }
    }
    _acceptInsertText(position, insertText) {
        if (insertText.length === 0) {
            // Nothing to insert
            return;
        }
        const insertLines = splitLines(insertText);
        if (insertLines.length === 1) {
            // Inserting text on one line
            this._setLineText(position.lineNumber - 1, this._lines[position.lineNumber - 1].substring(0, position.column - 1)
                + insertLines[0]
                + this._lines[position.lineNumber - 1].substring(position.column - 1));
            return;
        }
        // Append overflowing text from first line to the end of text to insert
        insertLines[insertLines.length - 1] += this._lines[position.lineNumber - 1].substring(position.column - 1);
        // Delete overflowing text from first line and insert text on first line
        this._setLineText(position.lineNumber - 1, this._lines[position.lineNumber - 1].substring(0, position.column - 1)
            + insertLines[0]);
        // Insert new lines & store lengths
        const newLengths = new Uint32Array(insertLines.length - 1);
        for (let i = 1; i < insertLines.length; i++) {
            this._lines.splice(position.lineNumber + i - 1, 0, insertLines[i]);
            newLengths[i - 1] = insertLines[i].length + this._eol.length;
        }
        if (this._lineStarts) {
            // update prefix sum
            this._lineStarts.insertValues(position.lineNumber, newLengths);
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';
/**
 * Create a word definition regular expression based on default word separators.
 * Optionally provide allowed separators that should be included in words.
 *
 * The default would look like this:
 * /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
 */
function createWordRegExp(allowInWords = '') {
    let source = '(-?\\d*\\.\\d\\w*)|([^';
    for (const sep of USUAL_WORD_SEPARATORS) {
        if (allowInWords.indexOf(sep) >= 0) {
            continue;
        }
        source += '\\' + sep;
    }
    source += '\\s]+)';
    return new RegExp(source, 'g');
}
// catches numbers (including floating numbers) in the first group, and alphanum in the second
const DEFAULT_WORD_REGEXP = createWordRegExp();
function ensureValidWordDefinition(wordDefinition) {
    let result = DEFAULT_WORD_REGEXP;
    if (wordDefinition && (wordDefinition instanceof RegExp)) {
        if (!wordDefinition.global) {
            let flags = 'g';
            if (wordDefinition.ignoreCase) {
                flags += 'i';
            }
            if (wordDefinition.multiline) {
                flags += 'm';
            }
            if (wordDefinition.unicode) {
                flags += 'u';
            }
            result = new RegExp(wordDefinition.source, flags);
        }
        else {
            result = wordDefinition;
        }
    }
    result.lastIndex = 0;
    return result;
}
const _defaultConfig = new LinkedList();
_defaultConfig.unshift({
    maxLen: 1000,
    windowSize: 15,
    timeBudget: 150
});
function getWordAtText(column, wordDefinition, text, textOffset, config) {
    // Ensure the regex has the 'g' flag, otherwise this will loop forever
    wordDefinition = ensureValidWordDefinition(wordDefinition);
    if (!config) {
        config = Iterable.first(_defaultConfig);
    }
    if (text.length > config.maxLen) {
        // don't throw strings that long at the regexp
        // but use a sub-string in which a word must occur
        let start = column - config.maxLen / 2;
        if (start < 0) {
            start = 0;
        }
        else {
            textOffset += start;
        }
        text = text.substring(start, column + config.maxLen / 2);
        return getWordAtText(column, wordDefinition, text, textOffset, config);
    }
    const t1 = Date.now();
    const pos = column - 1 - textOffset;
    let prevRegexIndex = -1;
    let match = null;
    for (let i = 1;; i++) {
        // check time budget
        if (Date.now() - t1 >= config.timeBudget) {
            break;
        }
        // reset the index at which the regexp should start matching, also know where it
        // should stop so that subsequent search don't repeat previous searches
        const regexIndex = pos - config.windowSize * i;
        wordDefinition.lastIndex = Math.max(0, regexIndex);
        const thisMatch = _findRegexMatchEnclosingPosition(wordDefinition, text, pos, prevRegexIndex);
        if (!thisMatch && match) {
            // stop: we have something
            break;
        }
        match = thisMatch;
        // stop: searched at start
        if (regexIndex <= 0) {
            break;
        }
        prevRegexIndex = regexIndex;
    }
    if (match) {
        const result = {
            word: match[0],
            startColumn: textOffset + 1 + match.index,
            endColumn: textOffset + 1 + match.index + match[0].length
        };
        wordDefinition.lastIndex = 0;
        return result;
    }
    return null;
}
function _findRegexMatchEnclosingPosition(wordDefinition, text, pos, stopPos) {
    let match;
    while (match = wordDefinition.exec(text)) {
        const matchIndex = match.index || 0;
        if (matchIndex <= pos && wordDefinition.lastIndex >= pos) {
            return match;
        }
        else if (stopPos > 0 && matchIndex > stopPos) {
            return null;
        }
    }
    return null;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A fast character classifier that uses a compact array for ASCII values.
 */
class CharacterClassifier {
    constructor(_defaultValue) {
        const defaultValue = toUint8(_defaultValue);
        this._defaultValue = defaultValue;
        this._asciiMap = CharacterClassifier._createAsciiMap(defaultValue);
        this._map = new Map();
    }
    static _createAsciiMap(defaultValue) {
        const asciiMap = new Uint8Array(256);
        asciiMap.fill(defaultValue);
        return asciiMap;
    }
    set(charCode, _value) {
        const value = toUint8(_value);
        if (charCode >= 0 && charCode < 256) {
            this._asciiMap[charCode] = value;
        }
        else {
            this._map.set(charCode, value);
        }
    }
    get(charCode) {
        if (charCode >= 0 && charCode < 256) {
            return this._asciiMap[charCode];
        }
        else {
            return (this._map.get(charCode) || this._defaultValue);
        }
    }
    clear() {
        this._asciiMap.fill(this._defaultValue);
        this._map.clear();
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class Uint8Matrix {
    constructor(rows, cols, defaultValue) {
        const data = new Uint8Array(rows * cols);
        for (let i = 0, len = rows * cols; i < len; i++) {
            data[i] = defaultValue;
        }
        this._data = data;
        this.rows = rows;
        this.cols = cols;
    }
    get(row, col) {
        return this._data[row * this.cols + col];
    }
    set(row, col, value) {
        this._data[row * this.cols + col] = value;
    }
}
class StateMachine {
    constructor(edges) {
        let maxCharCode = 0;
        let maxState = 0 /* State.Invalid */;
        for (let i = 0, len = edges.length; i < len; i++) {
            const [from, chCode, to] = edges[i];
            if (chCode > maxCharCode) {
                maxCharCode = chCode;
            }
            if (from > maxState) {
                maxState = from;
            }
            if (to > maxState) {
                maxState = to;
            }
        }
        maxCharCode++;
        maxState++;
        const states = new Uint8Matrix(maxState, maxCharCode, 0 /* State.Invalid */);
        for (let i = 0, len = edges.length; i < len; i++) {
            const [from, chCode, to] = edges[i];
            states.set(from, chCode, to);
        }
        this._states = states;
        this._maxCharCode = maxCharCode;
    }
    nextState(currentState, chCode) {
        if (chCode < 0 || chCode >= this._maxCharCode) {
            return 0 /* State.Invalid */;
        }
        return this._states.get(currentState, chCode);
    }
}
// State machine for http:// or https:// or file://
let _stateMachine = null;
function getStateMachine() {
    if (_stateMachine === null) {
        _stateMachine = new StateMachine([
            [1 /* State.Start */, 104 /* CharCode.h */, 2 /* State.H */],
            [1 /* State.Start */, 72 /* CharCode.H */, 2 /* State.H */],
            [1 /* State.Start */, 102 /* CharCode.f */, 6 /* State.F */],
            [1 /* State.Start */, 70 /* CharCode.F */, 6 /* State.F */],
            [2 /* State.H */, 116 /* CharCode.t */, 3 /* State.HT */],
            [2 /* State.H */, 84 /* CharCode.T */, 3 /* State.HT */],
            [3 /* State.HT */, 116 /* CharCode.t */, 4 /* State.HTT */],
            [3 /* State.HT */, 84 /* CharCode.T */, 4 /* State.HTT */],
            [4 /* State.HTT */, 112 /* CharCode.p */, 5 /* State.HTTP */],
            [4 /* State.HTT */, 80 /* CharCode.P */, 5 /* State.HTTP */],
            [5 /* State.HTTP */, 115 /* CharCode.s */, 9 /* State.BeforeColon */],
            [5 /* State.HTTP */, 83 /* CharCode.S */, 9 /* State.BeforeColon */],
            [5 /* State.HTTP */, 58 /* CharCode.Colon */, 10 /* State.AfterColon */],
            [6 /* State.F */, 105 /* CharCode.i */, 7 /* State.FI */],
            [6 /* State.F */, 73 /* CharCode.I */, 7 /* State.FI */],
            [7 /* State.FI */, 108 /* CharCode.l */, 8 /* State.FIL */],
            [7 /* State.FI */, 76 /* CharCode.L */, 8 /* State.FIL */],
            [8 /* State.FIL */, 101 /* CharCode.e */, 9 /* State.BeforeColon */],
            [8 /* State.FIL */, 69 /* CharCode.E */, 9 /* State.BeforeColon */],
            [9 /* State.BeforeColon */, 58 /* CharCode.Colon */, 10 /* State.AfterColon */],
            [10 /* State.AfterColon */, 47 /* CharCode.Slash */, 11 /* State.AlmostThere */],
            [11 /* State.AlmostThere */, 47 /* CharCode.Slash */, 12 /* State.End */],
        ]);
    }
    return _stateMachine;
}
let _classifier = null;
function getClassifier() {
    if (_classifier === null) {
        _classifier = new CharacterClassifier(0 /* CharacterClass.None */);
        // allow-any-unicode-next-line
        const FORCE_TERMINATION_CHARACTERS = ' \t<>\'\"、。｡､，．：；‘〈「『〔（［｛｢｣｝］）〕』」〉’｀～…';
        for (let i = 0; i < FORCE_TERMINATION_CHARACTERS.length; i++) {
            _classifier.set(FORCE_TERMINATION_CHARACTERS.charCodeAt(i), 1 /* CharacterClass.ForceTermination */);
        }
        const CANNOT_END_WITH_CHARACTERS = '.,;:';
        for (let i = 0; i < CANNOT_END_WITH_CHARACTERS.length; i++) {
            _classifier.set(CANNOT_END_WITH_CHARACTERS.charCodeAt(i), 2 /* CharacterClass.CannotEndIn */);
        }
    }
    return _classifier;
}
class LinkComputer {
    static _createLink(classifier, line, lineNumber, linkBeginIndex, linkEndIndex) {
        // Do not allow to end link in certain characters...
        let lastIncludedCharIndex = linkEndIndex - 1;
        do {
            const chCode = line.charCodeAt(lastIncludedCharIndex);
            const chClass = classifier.get(chCode);
            if (chClass !== 2 /* CharacterClass.CannotEndIn */) {
                break;
            }
            lastIncludedCharIndex--;
        } while (lastIncludedCharIndex > linkBeginIndex);
        // Handle links enclosed in parens, square brackets and curlys.
        if (linkBeginIndex > 0) {
            const charCodeBeforeLink = line.charCodeAt(linkBeginIndex - 1);
            const lastCharCodeInLink = line.charCodeAt(lastIncludedCharIndex);
            if ((charCodeBeforeLink === 40 /* CharCode.OpenParen */ && lastCharCodeInLink === 41 /* CharCode.CloseParen */)
                || (charCodeBeforeLink === 91 /* CharCode.OpenSquareBracket */ && lastCharCodeInLink === 93 /* CharCode.CloseSquareBracket */)
                || (charCodeBeforeLink === 123 /* CharCode.OpenCurlyBrace */ && lastCharCodeInLink === 125 /* CharCode.CloseCurlyBrace */)) {
                // Do not end in ) if ( is before the link start
                // Do not end in ] if [ is before the link start
                // Do not end in } if { is before the link start
                lastIncludedCharIndex--;
            }
        }
        return {
            range: {
                startLineNumber: lineNumber,
                startColumn: linkBeginIndex + 1,
                endLineNumber: lineNumber,
                endColumn: lastIncludedCharIndex + 2
            },
            url: line.substring(linkBeginIndex, lastIncludedCharIndex + 1)
        };
    }
    static computeLinks(model, stateMachine = getStateMachine()) {
        const classifier = getClassifier();
        const result = [];
        for (let i = 1, lineCount = model.getLineCount(); i <= lineCount; i++) {
            const line = model.getLineContent(i);
            const len = line.length;
            let j = 0;
            let linkBeginIndex = 0;
            let linkBeginChCode = 0;
            let state = 1 /* State.Start */;
            let hasOpenParens = false;
            let hasOpenSquareBracket = false;
            let inSquareBrackets = false;
            let hasOpenCurlyBracket = false;
            while (j < len) {
                let resetStateMachine = false;
                const chCode = line.charCodeAt(j);
                if (state === 13 /* State.Accept */) {
                    let chClass;
                    switch (chCode) {
                        case 40 /* CharCode.OpenParen */:
                            hasOpenParens = true;
                            chClass = 0 /* CharacterClass.None */;
                            break;
                        case 41 /* CharCode.CloseParen */:
                            chClass = (hasOpenParens ? 0 /* CharacterClass.None */ : 1 /* CharacterClass.ForceTermination */);
                            break;
                        case 91 /* CharCode.OpenSquareBracket */:
                            inSquareBrackets = true;
                            hasOpenSquareBracket = true;
                            chClass = 0 /* CharacterClass.None */;
                            break;
                        case 93 /* CharCode.CloseSquareBracket */:
                            inSquareBrackets = false;
                            chClass = (hasOpenSquareBracket ? 0 /* CharacterClass.None */ : 1 /* CharacterClass.ForceTermination */);
                            break;
                        case 123 /* CharCode.OpenCurlyBrace */:
                            hasOpenCurlyBracket = true;
                            chClass = 0 /* CharacterClass.None */;
                            break;
                        case 125 /* CharCode.CloseCurlyBrace */:
                            chClass = (hasOpenCurlyBracket ? 0 /* CharacterClass.None */ : 1 /* CharacterClass.ForceTermination */);
                            break;
                        // The following three rules make it that ' or " or ` are allowed inside links
                        // only if the link is wrapped by some other quote character
                        case 39 /* CharCode.SingleQuote */:
                        case 34 /* CharCode.DoubleQuote */:
                        case 96 /* CharCode.BackTick */:
                            if (linkBeginChCode === chCode) {
                                chClass = 1 /* CharacterClass.ForceTermination */;
                            }
                            else if (linkBeginChCode === 39 /* CharCode.SingleQuote */ || linkBeginChCode === 34 /* CharCode.DoubleQuote */ || linkBeginChCode === 96 /* CharCode.BackTick */) {
                                chClass = 0 /* CharacterClass.None */;
                            }
                            else {
                                chClass = 1 /* CharacterClass.ForceTermination */;
                            }
                            break;
                        case 42 /* CharCode.Asterisk */:
                            // `*` terminates a link if the link began with `*`
                            chClass = (linkBeginChCode === 42 /* CharCode.Asterisk */) ? 1 /* CharacterClass.ForceTermination */ : 0 /* CharacterClass.None */;
                            break;
                        case 124 /* CharCode.Pipe */:
                            // `|` terminates a link if the link began with `|`
                            chClass = (linkBeginChCode === 124 /* CharCode.Pipe */) ? 1 /* CharacterClass.ForceTermination */ : 0 /* CharacterClass.None */;
                            break;
                        case 32 /* CharCode.Space */:
                            // ` ` allow space in between [ and ]
                            chClass = (inSquareBrackets ? 0 /* CharacterClass.None */ : 1 /* CharacterClass.ForceTermination */);
                            break;
                        default:
                            chClass = classifier.get(chCode);
                    }
                    // Check if character terminates link
                    if (chClass === 1 /* CharacterClass.ForceTermination */) {
                        result.push(LinkComputer._createLink(classifier, line, i, linkBeginIndex, j));
                        resetStateMachine = true;
                    }
                }
                else if (state === 12 /* State.End */) {
                    let chClass;
                    if (chCode === 91 /* CharCode.OpenSquareBracket */) {
                        // Allow for the authority part to contain ipv6 addresses which contain [ and ]
                        hasOpenSquareBracket = true;
                        chClass = 0 /* CharacterClass.None */;
                    }
                    else {
                        chClass = classifier.get(chCode);
                    }
                    // Check if character terminates link
                    if (chClass === 1 /* CharacterClass.ForceTermination */) {
                        resetStateMachine = true;
                    }
                    else {
                        state = 13 /* State.Accept */;
                    }
                }
                else {
                    state = stateMachine.nextState(state, chCode);
                    if (state === 0 /* State.Invalid */) {
                        resetStateMachine = true;
                    }
                }
                if (resetStateMachine) {
                    state = 1 /* State.Start */;
                    hasOpenParens = false;
                    hasOpenSquareBracket = false;
                    hasOpenCurlyBracket = false;
                    // Record where the link started
                    linkBeginIndex = j + 1;
                    linkBeginChCode = chCode;
                }
                j++;
            }
            if (state === 13 /* State.Accept */) {
                result.push(LinkComputer._createLink(classifier, line, i, linkBeginIndex, len));
            }
        }
        return result;
    }
}
/**
 * Returns an array of all links contains in the provided
 * document. *Note* that this operation is computational
 * expensive and should not run in the UI thread.
 */
function computeLinks(model) {
    if (!model || typeof model.getLineCount !== 'function' || typeof model.getLineContent !== 'function') {
        // Unknown caller!
        return [];
    }
    return LinkComputer.computeLinks(model);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class BasicInplaceReplace {
    constructor() {
        this._defaultValueSet = [
            ['true', 'false'],
            ['True', 'False'],
            ['Private', 'Public', 'Friend', 'ReadOnly', 'Partial', 'Protected', 'WriteOnly'],
            ['public', 'protected', 'private'],
        ];
    }
    navigateValueSet(range1, text1, range2, text2, up) {
        if (range1 && text1) {
            const result = this.doNavigateValueSet(text1, up);
            if (result) {
                return {
                    range: range1,
                    value: result
                };
            }
        }
        if (range2 && text2) {
            const result = this.doNavigateValueSet(text2, up);
            if (result) {
                return {
                    range: range2,
                    value: result
                };
            }
        }
        return null;
    }
    doNavigateValueSet(text, up) {
        const numberResult = this.numberReplace(text, up);
        if (numberResult !== null) {
            return numberResult;
        }
        return this.textReplace(text, up);
    }
    numberReplace(value, up) {
        const precision = Math.pow(10, value.length - (value.lastIndexOf('.') + 1));
        let n1 = Number(value);
        const n2 = parseFloat(value);
        if (!isNaN(n1) && !isNaN(n2) && n1 === n2) {
            if (n1 === 0 && !up) {
                return null; // don't do negative
                //			} else if(n1 === 9 && up) {
                //				return null; // don't insert 10 into a number
            }
            else {
                n1 = Math.floor(n1 * precision);
                n1 += up ? precision : -precision;
                return String(n1 / precision);
            }
        }
        return null;
    }
    textReplace(value, up) {
        return this.valueSetsReplace(this._defaultValueSet, value, up);
    }
    valueSetsReplace(valueSets, value, up) {
        let result = null;
        for (let i = 0, len = valueSets.length; result === null && i < len; i++) {
            result = this.valueSetReplace(valueSets[i], value, up);
        }
        return result;
    }
    valueSetReplace(valueSet, value, up) {
        let idx = valueSet.indexOf(value);
        if (idx >= 0) {
            idx += up ? +1 : -1;
            if (idx < 0) {
                idx = valueSet.length - 1;
            }
            else {
                idx %= valueSet.length;
            }
            return valueSet[idx];
        }
        return null;
    }
}
BasicInplaceReplace.INSTANCE = new BasicInplaceReplace();

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const shortcutEvent = Object.freeze(function (callback, context) {
    const handle = setTimeout(callback.bind(context), 0);
    return { dispose() { clearTimeout(handle); } };
});
var CancellationToken;
(function (CancellationToken) {
    function isCancellationToken(thing) {
        if (thing === CancellationToken.None || thing === CancellationToken.Cancelled) {
            return true;
        }
        if (thing instanceof MutableToken) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return typeof thing.isCancellationRequested === 'boolean'
            && typeof thing.onCancellationRequested === 'function';
    }
    CancellationToken.isCancellationToken = isCancellationToken;
    CancellationToken.None = Object.freeze({
        isCancellationRequested: false,
        onCancellationRequested: Event.None
    });
    CancellationToken.Cancelled = Object.freeze({
        isCancellationRequested: true,
        onCancellationRequested: shortcutEvent
    });
})(CancellationToken || (CancellationToken = {}));
class MutableToken {
    constructor() {
        this._isCancelled = false;
        this._emitter = null;
    }
    cancel() {
        if (!this._isCancelled) {
            this._isCancelled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this.dispose();
            }
        }
    }
    get isCancellationRequested() {
        return this._isCancelled;
    }
    get onCancellationRequested() {
        if (this._isCancelled) {
            return shortcutEvent;
        }
        if (!this._emitter) {
            this._emitter = new Emitter();
        }
        return this._emitter.event;
    }
    dispose() {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = null;
        }
    }
}
class CancellationTokenSource {
    constructor(parent) {
        this._token = undefined;
        this._parentListener = undefined;
        this._parentListener = parent && parent.onCancellationRequested(this.cancel, this);
    }
    get token() {
        if (!this._token) {
            // be lazy and create the token only when
            // actually needed
            this._token = new MutableToken();
        }
        return this._token;
    }
    cancel() {
        if (!this._token) {
            // save an object by returning the default
            // cancelled token when cancellation happens
            // before someone asks for the token
            this._token = CancellationToken.Cancelled;
        }
        else if (this._token instanceof MutableToken) {
            // actually cancel
            this._token.cancel();
        }
    }
    dispose(cancel = false) {
        var _a;
        if (cancel) {
            this.cancel();
        }
        (_a = this._parentListener) === null || _a === void 0 ? void 0 : _a.dispose();
        if (!this._token) {
            // ensure to initialize with an empty token if we had none
            this._token = CancellationToken.None;
        }
        else if (this._token instanceof MutableToken) {
            // actually dispose
            this._token.dispose();
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class KeyCodeStrMap {
    constructor() {
        this._keyCodeToStr = [];
        this._strToKeyCode = Object.create(null);
    }
    define(keyCode, str) {
        this._keyCodeToStr[keyCode] = str;
        this._strToKeyCode[str.toLowerCase()] = keyCode;
    }
    keyCodeToStr(keyCode) {
        return this._keyCodeToStr[keyCode];
    }
    strToKeyCode(str) {
        return this._strToKeyCode[str.toLowerCase()] || 0 /* KeyCode.Unknown */;
    }
}
const uiMap = new KeyCodeStrMap();
const userSettingsUSMap = new KeyCodeStrMap();
const userSettingsGeneralMap = new KeyCodeStrMap();
const EVENT_KEY_CODE_MAP = new Array(230);
const scanCodeStrToInt = Object.create(null);
const scanCodeLowerCaseStrToInt = Object.create(null);
(function () {
    // See https://msdn.microsoft.com/en-us/library/windows/desktop/dd375731(v=vs.85).aspx
    // See https://github.com/microsoft/node-native-keymap/blob/88c0b0e5/deps/chromium/keyboard_codes_win.h
    const empty = '';
    const mappings = [
        // immutable, scanCode, scanCodeStr, keyCode, keyCodeStr, eventKeyCode, vkey, usUserSettingsLabel, generalUserSettingsLabel
        [1, 0 /* ScanCode.None */, 'None', 0 /* KeyCode.Unknown */, 'unknown', 0, 'VK_UNKNOWN', empty, empty],
        [1, 1 /* ScanCode.Hyper */, 'Hyper', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 2 /* ScanCode.Super */, 'Super', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 3 /* ScanCode.Fn */, 'Fn', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 4 /* ScanCode.FnLock */, 'FnLock', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 5 /* ScanCode.Suspend */, 'Suspend', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 6 /* ScanCode.Resume */, 'Resume', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 7 /* ScanCode.Turbo */, 'Turbo', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 8 /* ScanCode.Sleep */, 'Sleep', 0 /* KeyCode.Unknown */, empty, 0, 'VK_SLEEP', empty, empty],
        [1, 9 /* ScanCode.WakeUp */, 'WakeUp', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [0, 10 /* ScanCode.KeyA */, 'KeyA', 31 /* KeyCode.KeyA */, 'A', 65, 'VK_A', empty, empty],
        [0, 11 /* ScanCode.KeyB */, 'KeyB', 32 /* KeyCode.KeyB */, 'B', 66, 'VK_B', empty, empty],
        [0, 12 /* ScanCode.KeyC */, 'KeyC', 33 /* KeyCode.KeyC */, 'C', 67, 'VK_C', empty, empty],
        [0, 13 /* ScanCode.KeyD */, 'KeyD', 34 /* KeyCode.KeyD */, 'D', 68, 'VK_D', empty, empty],
        [0, 14 /* ScanCode.KeyE */, 'KeyE', 35 /* KeyCode.KeyE */, 'E', 69, 'VK_E', empty, empty],
        [0, 15 /* ScanCode.KeyF */, 'KeyF', 36 /* KeyCode.KeyF */, 'F', 70, 'VK_F', empty, empty],
        [0, 16 /* ScanCode.KeyG */, 'KeyG', 37 /* KeyCode.KeyG */, 'G', 71, 'VK_G', empty, empty],
        [0, 17 /* ScanCode.KeyH */, 'KeyH', 38 /* KeyCode.KeyH */, 'H', 72, 'VK_H', empty, empty],
        [0, 18 /* ScanCode.KeyI */, 'KeyI', 39 /* KeyCode.KeyI */, 'I', 73, 'VK_I', empty, empty],
        [0, 19 /* ScanCode.KeyJ */, 'KeyJ', 40 /* KeyCode.KeyJ */, 'J', 74, 'VK_J', empty, empty],
        [0, 20 /* ScanCode.KeyK */, 'KeyK', 41 /* KeyCode.KeyK */, 'K', 75, 'VK_K', empty, empty],
        [0, 21 /* ScanCode.KeyL */, 'KeyL', 42 /* KeyCode.KeyL */, 'L', 76, 'VK_L', empty, empty],
        [0, 22 /* ScanCode.KeyM */, 'KeyM', 43 /* KeyCode.KeyM */, 'M', 77, 'VK_M', empty, empty],
        [0, 23 /* ScanCode.KeyN */, 'KeyN', 44 /* KeyCode.KeyN */, 'N', 78, 'VK_N', empty, empty],
        [0, 24 /* ScanCode.KeyO */, 'KeyO', 45 /* KeyCode.KeyO */, 'O', 79, 'VK_O', empty, empty],
        [0, 25 /* ScanCode.KeyP */, 'KeyP', 46 /* KeyCode.KeyP */, 'P', 80, 'VK_P', empty, empty],
        [0, 26 /* ScanCode.KeyQ */, 'KeyQ', 47 /* KeyCode.KeyQ */, 'Q', 81, 'VK_Q', empty, empty],
        [0, 27 /* ScanCode.KeyR */, 'KeyR', 48 /* KeyCode.KeyR */, 'R', 82, 'VK_R', empty, empty],
        [0, 28 /* ScanCode.KeyS */, 'KeyS', 49 /* KeyCode.KeyS */, 'S', 83, 'VK_S', empty, empty],
        [0, 29 /* ScanCode.KeyT */, 'KeyT', 50 /* KeyCode.KeyT */, 'T', 84, 'VK_T', empty, empty],
        [0, 30 /* ScanCode.KeyU */, 'KeyU', 51 /* KeyCode.KeyU */, 'U', 85, 'VK_U', empty, empty],
        [0, 31 /* ScanCode.KeyV */, 'KeyV', 52 /* KeyCode.KeyV */, 'V', 86, 'VK_V', empty, empty],
        [0, 32 /* ScanCode.KeyW */, 'KeyW', 53 /* KeyCode.KeyW */, 'W', 87, 'VK_W', empty, empty],
        [0, 33 /* ScanCode.KeyX */, 'KeyX', 54 /* KeyCode.KeyX */, 'X', 88, 'VK_X', empty, empty],
        [0, 34 /* ScanCode.KeyY */, 'KeyY', 55 /* KeyCode.KeyY */, 'Y', 89, 'VK_Y', empty, empty],
        [0, 35 /* ScanCode.KeyZ */, 'KeyZ', 56 /* KeyCode.KeyZ */, 'Z', 90, 'VK_Z', empty, empty],
        [0, 36 /* ScanCode.Digit1 */, 'Digit1', 22 /* KeyCode.Digit1 */, '1', 49, 'VK_1', empty, empty],
        [0, 37 /* ScanCode.Digit2 */, 'Digit2', 23 /* KeyCode.Digit2 */, '2', 50, 'VK_2', empty, empty],
        [0, 38 /* ScanCode.Digit3 */, 'Digit3', 24 /* KeyCode.Digit3 */, '3', 51, 'VK_3', empty, empty],
        [0, 39 /* ScanCode.Digit4 */, 'Digit4', 25 /* KeyCode.Digit4 */, '4', 52, 'VK_4', empty, empty],
        [0, 40 /* ScanCode.Digit5 */, 'Digit5', 26 /* KeyCode.Digit5 */, '5', 53, 'VK_5', empty, empty],
        [0, 41 /* ScanCode.Digit6 */, 'Digit6', 27 /* KeyCode.Digit6 */, '6', 54, 'VK_6', empty, empty],
        [0, 42 /* ScanCode.Digit7 */, 'Digit7', 28 /* KeyCode.Digit7 */, '7', 55, 'VK_7', empty, empty],
        [0, 43 /* ScanCode.Digit8 */, 'Digit8', 29 /* KeyCode.Digit8 */, '8', 56, 'VK_8', empty, empty],
        [0, 44 /* ScanCode.Digit9 */, 'Digit9', 30 /* KeyCode.Digit9 */, '9', 57, 'VK_9', empty, empty],
        [0, 45 /* ScanCode.Digit0 */, 'Digit0', 21 /* KeyCode.Digit0 */, '0', 48, 'VK_0', empty, empty],
        [1, 46 /* ScanCode.Enter */, 'Enter', 3 /* KeyCode.Enter */, 'Enter', 13, 'VK_RETURN', empty, empty],
        [1, 47 /* ScanCode.Escape */, 'Escape', 9 /* KeyCode.Escape */, 'Escape', 27, 'VK_ESCAPE', empty, empty],
        [1, 48 /* ScanCode.Backspace */, 'Backspace', 1 /* KeyCode.Backspace */, 'Backspace', 8, 'VK_BACK', empty, empty],
        [1, 49 /* ScanCode.Tab */, 'Tab', 2 /* KeyCode.Tab */, 'Tab', 9, 'VK_TAB', empty, empty],
        [1, 50 /* ScanCode.Space */, 'Space', 10 /* KeyCode.Space */, 'Space', 32, 'VK_SPACE', empty, empty],
        [0, 51 /* ScanCode.Minus */, 'Minus', 88 /* KeyCode.Minus */, '-', 189, 'VK_OEM_MINUS', '-', 'OEM_MINUS'],
        [0, 52 /* ScanCode.Equal */, 'Equal', 86 /* KeyCode.Equal */, '=', 187, 'VK_OEM_PLUS', '=', 'OEM_PLUS'],
        [0, 53 /* ScanCode.BracketLeft */, 'BracketLeft', 92 /* KeyCode.BracketLeft */, '[', 219, 'VK_OEM_4', '[', 'OEM_4'],
        [0, 54 /* ScanCode.BracketRight */, 'BracketRight', 94 /* KeyCode.BracketRight */, ']', 221, 'VK_OEM_6', ']', 'OEM_6'],
        [0, 55 /* ScanCode.Backslash */, 'Backslash', 93 /* KeyCode.Backslash */, '\\', 220, 'VK_OEM_5', '\\', 'OEM_5'],
        [0, 56 /* ScanCode.IntlHash */, 'IntlHash', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty], // has been dropped from the w3c spec
        [0, 57 /* ScanCode.Semicolon */, 'Semicolon', 85 /* KeyCode.Semicolon */, ';', 186, 'VK_OEM_1', ';', 'OEM_1'],
        [0, 58 /* ScanCode.Quote */, 'Quote', 95 /* KeyCode.Quote */, '\'', 222, 'VK_OEM_7', '\'', 'OEM_7'],
        [0, 59 /* ScanCode.Backquote */, 'Backquote', 91 /* KeyCode.Backquote */, '`', 192, 'VK_OEM_3', '`', 'OEM_3'],
        [0, 60 /* ScanCode.Comma */, 'Comma', 87 /* KeyCode.Comma */, ',', 188, 'VK_OEM_COMMA', ',', 'OEM_COMMA'],
        [0, 61 /* ScanCode.Period */, 'Period', 89 /* KeyCode.Period */, '.', 190, 'VK_OEM_PERIOD', '.', 'OEM_PERIOD'],
        [0, 62 /* ScanCode.Slash */, 'Slash', 90 /* KeyCode.Slash */, '/', 191, 'VK_OEM_2', '/', 'OEM_2'],
        [1, 63 /* ScanCode.CapsLock */, 'CapsLock', 8 /* KeyCode.CapsLock */, 'CapsLock', 20, 'VK_CAPITAL', empty, empty],
        [1, 64 /* ScanCode.F1 */, 'F1', 59 /* KeyCode.F1 */, 'F1', 112, 'VK_F1', empty, empty],
        [1, 65 /* ScanCode.F2 */, 'F2', 60 /* KeyCode.F2 */, 'F2', 113, 'VK_F2', empty, empty],
        [1, 66 /* ScanCode.F3 */, 'F3', 61 /* KeyCode.F3 */, 'F3', 114, 'VK_F3', empty, empty],
        [1, 67 /* ScanCode.F4 */, 'F4', 62 /* KeyCode.F4 */, 'F4', 115, 'VK_F4', empty, empty],
        [1, 68 /* ScanCode.F5 */, 'F5', 63 /* KeyCode.F5 */, 'F5', 116, 'VK_F5', empty, empty],
        [1, 69 /* ScanCode.F6 */, 'F6', 64 /* KeyCode.F6 */, 'F6', 117, 'VK_F6', empty, empty],
        [1, 70 /* ScanCode.F7 */, 'F7', 65 /* KeyCode.F7 */, 'F7', 118, 'VK_F7', empty, empty],
        [1, 71 /* ScanCode.F8 */, 'F8', 66 /* KeyCode.F8 */, 'F8', 119, 'VK_F8', empty, empty],
        [1, 72 /* ScanCode.F9 */, 'F9', 67 /* KeyCode.F9 */, 'F9', 120, 'VK_F9', empty, empty],
        [1, 73 /* ScanCode.F10 */, 'F10', 68 /* KeyCode.F10 */, 'F10', 121, 'VK_F10', empty, empty],
        [1, 74 /* ScanCode.F11 */, 'F11', 69 /* KeyCode.F11 */, 'F11', 122, 'VK_F11', empty, empty],
        [1, 75 /* ScanCode.F12 */, 'F12', 70 /* KeyCode.F12 */, 'F12', 123, 'VK_F12', empty, empty],
        [1, 76 /* ScanCode.PrintScreen */, 'PrintScreen', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 77 /* ScanCode.ScrollLock */, 'ScrollLock', 84 /* KeyCode.ScrollLock */, 'ScrollLock', 145, 'VK_SCROLL', empty, empty],
        [1, 78 /* ScanCode.Pause */, 'Pause', 7 /* KeyCode.PauseBreak */, 'PauseBreak', 19, 'VK_PAUSE', empty, empty],
        [1, 79 /* ScanCode.Insert */, 'Insert', 19 /* KeyCode.Insert */, 'Insert', 45, 'VK_INSERT', empty, empty],
        [1, 80 /* ScanCode.Home */, 'Home', 14 /* KeyCode.Home */, 'Home', 36, 'VK_HOME', empty, empty],
        [1, 81 /* ScanCode.PageUp */, 'PageUp', 11 /* KeyCode.PageUp */, 'PageUp', 33, 'VK_PRIOR', empty, empty],
        [1, 82 /* ScanCode.Delete */, 'Delete', 20 /* KeyCode.Delete */, 'Delete', 46, 'VK_DELETE', empty, empty],
        [1, 83 /* ScanCode.End */, 'End', 13 /* KeyCode.End */, 'End', 35, 'VK_END', empty, empty],
        [1, 84 /* ScanCode.PageDown */, 'PageDown', 12 /* KeyCode.PageDown */, 'PageDown', 34, 'VK_NEXT', empty, empty],
        [1, 85 /* ScanCode.ArrowRight */, 'ArrowRight', 17 /* KeyCode.RightArrow */, 'RightArrow', 39, 'VK_RIGHT', 'Right', empty],
        [1, 86 /* ScanCode.ArrowLeft */, 'ArrowLeft', 15 /* KeyCode.LeftArrow */, 'LeftArrow', 37, 'VK_LEFT', 'Left', empty],
        [1, 87 /* ScanCode.ArrowDown */, 'ArrowDown', 18 /* KeyCode.DownArrow */, 'DownArrow', 40, 'VK_DOWN', 'Down', empty],
        [1, 88 /* ScanCode.ArrowUp */, 'ArrowUp', 16 /* KeyCode.UpArrow */, 'UpArrow', 38, 'VK_UP', 'Up', empty],
        [1, 89 /* ScanCode.NumLock */, 'NumLock', 83 /* KeyCode.NumLock */, 'NumLock', 144, 'VK_NUMLOCK', empty, empty],
        [1, 90 /* ScanCode.NumpadDivide */, 'NumpadDivide', 113 /* KeyCode.NumpadDivide */, 'NumPad_Divide', 111, 'VK_DIVIDE', empty, empty],
        [1, 91 /* ScanCode.NumpadMultiply */, 'NumpadMultiply', 108 /* KeyCode.NumpadMultiply */, 'NumPad_Multiply', 106, 'VK_MULTIPLY', empty, empty],
        [1, 92 /* ScanCode.NumpadSubtract */, 'NumpadSubtract', 111 /* KeyCode.NumpadSubtract */, 'NumPad_Subtract', 109, 'VK_SUBTRACT', empty, empty],
        [1, 93 /* ScanCode.NumpadAdd */, 'NumpadAdd', 109 /* KeyCode.NumpadAdd */, 'NumPad_Add', 107, 'VK_ADD', empty, empty],
        [1, 94 /* ScanCode.NumpadEnter */, 'NumpadEnter', 3 /* KeyCode.Enter */, empty, 0, empty, empty, empty],
        [1, 95 /* ScanCode.Numpad1 */, 'Numpad1', 99 /* KeyCode.Numpad1 */, 'NumPad1', 97, 'VK_NUMPAD1', empty, empty],
        [1, 96 /* ScanCode.Numpad2 */, 'Numpad2', 100 /* KeyCode.Numpad2 */, 'NumPad2', 98, 'VK_NUMPAD2', empty, empty],
        [1, 97 /* ScanCode.Numpad3 */, 'Numpad3', 101 /* KeyCode.Numpad3 */, 'NumPad3', 99, 'VK_NUMPAD3', empty, empty],
        [1, 98 /* ScanCode.Numpad4 */, 'Numpad4', 102 /* KeyCode.Numpad4 */, 'NumPad4', 100, 'VK_NUMPAD4', empty, empty],
        [1, 99 /* ScanCode.Numpad5 */, 'Numpad5', 103 /* KeyCode.Numpad5 */, 'NumPad5', 101, 'VK_NUMPAD5', empty, empty],
        [1, 100 /* ScanCode.Numpad6 */, 'Numpad6', 104 /* KeyCode.Numpad6 */, 'NumPad6', 102, 'VK_NUMPAD6', empty, empty],
        [1, 101 /* ScanCode.Numpad7 */, 'Numpad7', 105 /* KeyCode.Numpad7 */, 'NumPad7', 103, 'VK_NUMPAD7', empty, empty],
        [1, 102 /* ScanCode.Numpad8 */, 'Numpad8', 106 /* KeyCode.Numpad8 */, 'NumPad8', 104, 'VK_NUMPAD8', empty, empty],
        [1, 103 /* ScanCode.Numpad9 */, 'Numpad9', 107 /* KeyCode.Numpad9 */, 'NumPad9', 105, 'VK_NUMPAD9', empty, empty],
        [1, 104 /* ScanCode.Numpad0 */, 'Numpad0', 98 /* KeyCode.Numpad0 */, 'NumPad0', 96, 'VK_NUMPAD0', empty, empty],
        [1, 105 /* ScanCode.NumpadDecimal */, 'NumpadDecimal', 112 /* KeyCode.NumpadDecimal */, 'NumPad_Decimal', 110, 'VK_DECIMAL', empty, empty],
        [0, 106 /* ScanCode.IntlBackslash */, 'IntlBackslash', 97 /* KeyCode.IntlBackslash */, 'OEM_102', 226, 'VK_OEM_102', empty, empty],
        [1, 107 /* ScanCode.ContextMenu */, 'ContextMenu', 58 /* KeyCode.ContextMenu */, 'ContextMenu', 93, empty, empty, empty],
        [1, 108 /* ScanCode.Power */, 'Power', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 109 /* ScanCode.NumpadEqual */, 'NumpadEqual', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 110 /* ScanCode.F13 */, 'F13', 71 /* KeyCode.F13 */, 'F13', 124, 'VK_F13', empty, empty],
        [1, 111 /* ScanCode.F14 */, 'F14', 72 /* KeyCode.F14 */, 'F14', 125, 'VK_F14', empty, empty],
        [1, 112 /* ScanCode.F15 */, 'F15', 73 /* KeyCode.F15 */, 'F15', 126, 'VK_F15', empty, empty],
        [1, 113 /* ScanCode.F16 */, 'F16', 74 /* KeyCode.F16 */, 'F16', 127, 'VK_F16', empty, empty],
        [1, 114 /* ScanCode.F17 */, 'F17', 75 /* KeyCode.F17 */, 'F17', 128, 'VK_F17', empty, empty],
        [1, 115 /* ScanCode.F18 */, 'F18', 76 /* KeyCode.F18 */, 'F18', 129, 'VK_F18', empty, empty],
        [1, 116 /* ScanCode.F19 */, 'F19', 77 /* KeyCode.F19 */, 'F19', 130, 'VK_F19', empty, empty],
        [1, 117 /* ScanCode.F20 */, 'F20', 78 /* KeyCode.F20 */, 'F20', 131, 'VK_F20', empty, empty],
        [1, 118 /* ScanCode.F21 */, 'F21', 79 /* KeyCode.F21 */, 'F21', 132, 'VK_F21', empty, empty],
        [1, 119 /* ScanCode.F22 */, 'F22', 80 /* KeyCode.F22 */, 'F22', 133, 'VK_F22', empty, empty],
        [1, 120 /* ScanCode.F23 */, 'F23', 81 /* KeyCode.F23 */, 'F23', 134, 'VK_F23', empty, empty],
        [1, 121 /* ScanCode.F24 */, 'F24', 82 /* KeyCode.F24 */, 'F24', 135, 'VK_F24', empty, empty],
        [1, 122 /* ScanCode.Open */, 'Open', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 123 /* ScanCode.Help */, 'Help', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 124 /* ScanCode.Select */, 'Select', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 125 /* ScanCode.Again */, 'Again', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 126 /* ScanCode.Undo */, 'Undo', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 127 /* ScanCode.Cut */, 'Cut', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 128 /* ScanCode.Copy */, 'Copy', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 129 /* ScanCode.Paste */, 'Paste', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 130 /* ScanCode.Find */, 'Find', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 131 /* ScanCode.AudioVolumeMute */, 'AudioVolumeMute', 117 /* KeyCode.AudioVolumeMute */, 'AudioVolumeMute', 173, 'VK_VOLUME_MUTE', empty, empty],
        [1, 132 /* ScanCode.AudioVolumeUp */, 'AudioVolumeUp', 118 /* KeyCode.AudioVolumeUp */, 'AudioVolumeUp', 175, 'VK_VOLUME_UP', empty, empty],
        [1, 133 /* ScanCode.AudioVolumeDown */, 'AudioVolumeDown', 119 /* KeyCode.AudioVolumeDown */, 'AudioVolumeDown', 174, 'VK_VOLUME_DOWN', empty, empty],
        [1, 134 /* ScanCode.NumpadComma */, 'NumpadComma', 110 /* KeyCode.NUMPAD_SEPARATOR */, 'NumPad_Separator', 108, 'VK_SEPARATOR', empty, empty],
        [0, 135 /* ScanCode.IntlRo */, 'IntlRo', 115 /* KeyCode.ABNT_C1 */, 'ABNT_C1', 193, 'VK_ABNT_C1', empty, empty],
        [1, 136 /* ScanCode.KanaMode */, 'KanaMode', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [0, 137 /* ScanCode.IntlYen */, 'IntlYen', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 138 /* ScanCode.Convert */, 'Convert', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 139 /* ScanCode.NonConvert */, 'NonConvert', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 140 /* ScanCode.Lang1 */, 'Lang1', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 141 /* ScanCode.Lang2 */, 'Lang2', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 142 /* ScanCode.Lang3 */, 'Lang3', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 143 /* ScanCode.Lang4 */, 'Lang4', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 144 /* ScanCode.Lang5 */, 'Lang5', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 145 /* ScanCode.Abort */, 'Abort', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 146 /* ScanCode.Props */, 'Props', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 147 /* ScanCode.NumpadParenLeft */, 'NumpadParenLeft', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 148 /* ScanCode.NumpadParenRight */, 'NumpadParenRight', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 149 /* ScanCode.NumpadBackspace */, 'NumpadBackspace', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 150 /* ScanCode.NumpadMemoryStore */, 'NumpadMemoryStore', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 151 /* ScanCode.NumpadMemoryRecall */, 'NumpadMemoryRecall', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 152 /* ScanCode.NumpadMemoryClear */, 'NumpadMemoryClear', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 153 /* ScanCode.NumpadMemoryAdd */, 'NumpadMemoryAdd', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 154 /* ScanCode.NumpadMemorySubtract */, 'NumpadMemorySubtract', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 155 /* ScanCode.NumpadClear */, 'NumpadClear', 131 /* KeyCode.Clear */, 'Clear', 12, 'VK_CLEAR', empty, empty],
        [1, 156 /* ScanCode.NumpadClearEntry */, 'NumpadClearEntry', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 0 /* ScanCode.None */, empty, 5 /* KeyCode.Ctrl */, 'Ctrl', 17, 'VK_CONTROL', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 4 /* KeyCode.Shift */, 'Shift', 16, 'VK_SHIFT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 6 /* KeyCode.Alt */, 'Alt', 18, 'VK_MENU', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 57 /* KeyCode.Meta */, 'Meta', 91, 'VK_COMMAND', empty, empty],
        [1, 157 /* ScanCode.ControlLeft */, 'ControlLeft', 5 /* KeyCode.Ctrl */, empty, 0, 'VK_LCONTROL', empty, empty],
        [1, 158 /* ScanCode.ShiftLeft */, 'ShiftLeft', 4 /* KeyCode.Shift */, empty, 0, 'VK_LSHIFT', empty, empty],
        [1, 159 /* ScanCode.AltLeft */, 'AltLeft', 6 /* KeyCode.Alt */, empty, 0, 'VK_LMENU', empty, empty],
        [1, 160 /* ScanCode.MetaLeft */, 'MetaLeft', 57 /* KeyCode.Meta */, empty, 0, 'VK_LWIN', empty, empty],
        [1, 161 /* ScanCode.ControlRight */, 'ControlRight', 5 /* KeyCode.Ctrl */, empty, 0, 'VK_RCONTROL', empty, empty],
        [1, 162 /* ScanCode.ShiftRight */, 'ShiftRight', 4 /* KeyCode.Shift */, empty, 0, 'VK_RSHIFT', empty, empty],
        [1, 163 /* ScanCode.AltRight */, 'AltRight', 6 /* KeyCode.Alt */, empty, 0, 'VK_RMENU', empty, empty],
        [1, 164 /* ScanCode.MetaRight */, 'MetaRight', 57 /* KeyCode.Meta */, empty, 0, 'VK_RWIN', empty, empty],
        [1, 165 /* ScanCode.BrightnessUp */, 'BrightnessUp', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 166 /* ScanCode.BrightnessDown */, 'BrightnessDown', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 167 /* ScanCode.MediaPlay */, 'MediaPlay', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 168 /* ScanCode.MediaRecord */, 'MediaRecord', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 169 /* ScanCode.MediaFastForward */, 'MediaFastForward', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 170 /* ScanCode.MediaRewind */, 'MediaRewind', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 171 /* ScanCode.MediaTrackNext */, 'MediaTrackNext', 124 /* KeyCode.MediaTrackNext */, 'MediaTrackNext', 176, 'VK_MEDIA_NEXT_TRACK', empty, empty],
        [1, 172 /* ScanCode.MediaTrackPrevious */, 'MediaTrackPrevious', 125 /* KeyCode.MediaTrackPrevious */, 'MediaTrackPrevious', 177, 'VK_MEDIA_PREV_TRACK', empty, empty],
        [1, 173 /* ScanCode.MediaStop */, 'MediaStop', 126 /* KeyCode.MediaStop */, 'MediaStop', 178, 'VK_MEDIA_STOP', empty, empty],
        [1, 174 /* ScanCode.Eject */, 'Eject', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 175 /* ScanCode.MediaPlayPause */, 'MediaPlayPause', 127 /* KeyCode.MediaPlayPause */, 'MediaPlayPause', 179, 'VK_MEDIA_PLAY_PAUSE', empty, empty],
        [1, 176 /* ScanCode.MediaSelect */, 'MediaSelect', 128 /* KeyCode.LaunchMediaPlayer */, 'LaunchMediaPlayer', 181, 'VK_MEDIA_LAUNCH_MEDIA_SELECT', empty, empty],
        [1, 177 /* ScanCode.LaunchMail */, 'LaunchMail', 129 /* KeyCode.LaunchMail */, 'LaunchMail', 180, 'VK_MEDIA_LAUNCH_MAIL', empty, empty],
        [1, 178 /* ScanCode.LaunchApp2 */, 'LaunchApp2', 130 /* KeyCode.LaunchApp2 */, 'LaunchApp2', 183, 'VK_MEDIA_LAUNCH_APP2', empty, empty],
        [1, 179 /* ScanCode.LaunchApp1 */, 'LaunchApp1', 0 /* KeyCode.Unknown */, empty, 0, 'VK_MEDIA_LAUNCH_APP1', empty, empty],
        [1, 180 /* ScanCode.SelectTask */, 'SelectTask', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 181 /* ScanCode.LaunchScreenSaver */, 'LaunchScreenSaver', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 182 /* ScanCode.BrowserSearch */, 'BrowserSearch', 120 /* KeyCode.BrowserSearch */, 'BrowserSearch', 170, 'VK_BROWSER_SEARCH', empty, empty],
        [1, 183 /* ScanCode.BrowserHome */, 'BrowserHome', 121 /* KeyCode.BrowserHome */, 'BrowserHome', 172, 'VK_BROWSER_HOME', empty, empty],
        [1, 184 /* ScanCode.BrowserBack */, 'BrowserBack', 122 /* KeyCode.BrowserBack */, 'BrowserBack', 166, 'VK_BROWSER_BACK', empty, empty],
        [1, 185 /* ScanCode.BrowserForward */, 'BrowserForward', 123 /* KeyCode.BrowserForward */, 'BrowserForward', 167, 'VK_BROWSER_FORWARD', empty, empty],
        [1, 186 /* ScanCode.BrowserStop */, 'BrowserStop', 0 /* KeyCode.Unknown */, empty, 0, 'VK_BROWSER_STOP', empty, empty],
        [1, 187 /* ScanCode.BrowserRefresh */, 'BrowserRefresh', 0 /* KeyCode.Unknown */, empty, 0, 'VK_BROWSER_REFRESH', empty, empty],
        [1, 188 /* ScanCode.BrowserFavorites */, 'BrowserFavorites', 0 /* KeyCode.Unknown */, empty, 0, 'VK_BROWSER_FAVORITES', empty, empty],
        [1, 189 /* ScanCode.ZoomToggle */, 'ZoomToggle', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 190 /* ScanCode.MailReply */, 'MailReply', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 191 /* ScanCode.MailForward */, 'MailForward', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        [1, 192 /* ScanCode.MailSend */, 'MailSend', 0 /* KeyCode.Unknown */, empty, 0, empty, empty, empty],
        // See https://lists.w3.org/Archives/Public/www-dom/2010JulSep/att-0182/keyCode-spec.html
        // If an Input Method Editor is processing key input and the event is keydown, return 229.
        [1, 0 /* ScanCode.None */, empty, 114 /* KeyCode.KEY_IN_COMPOSITION */, 'KeyInComposition', 229, empty, empty, empty],
        [1, 0 /* ScanCode.None */, empty, 116 /* KeyCode.ABNT_C2 */, 'ABNT_C2', 194, 'VK_ABNT_C2', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 96 /* KeyCode.OEM_8 */, 'OEM_8', 223, 'VK_OEM_8', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_KANA', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_HANGUL', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_JUNJA', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_FINAL', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_HANJA', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_KANJI', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_CONVERT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_NONCONVERT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_ACCEPT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_MODECHANGE', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_SELECT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_PRINT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_EXECUTE', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_SNAPSHOT', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_HELP', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_APPS', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_PROCESSKEY', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_PACKET', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_DBE_SBCSCHAR', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_DBE_DBCSCHAR', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_ATTN', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_CRSEL', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_EXSEL', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_EREOF', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_PLAY', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_ZOOM', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_NONAME', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_PA1', empty, empty],
        [1, 0 /* ScanCode.None */, empty, 0 /* KeyCode.Unknown */, empty, 0, 'VK_OEM_CLEAR', empty, empty],
    ];
    const seenKeyCode = [];
    const seenScanCode = [];
    for (const mapping of mappings) {
        const [immutable, scanCode, scanCodeStr, keyCode, keyCodeStr, eventKeyCode, vkey, usUserSettingsLabel, generalUserSettingsLabel] = mapping;
        if (!seenScanCode[scanCode]) {
            seenScanCode[scanCode] = true;
            scanCodeStrToInt[scanCodeStr] = scanCode;
            scanCodeLowerCaseStrToInt[scanCodeStr.toLowerCase()] = scanCode;
        }
        if (!seenKeyCode[keyCode]) {
            seenKeyCode[keyCode] = true;
            if (!keyCodeStr) {
                throw new Error(`String representation missing for key code ${keyCode} around scan code ${scanCodeStr}`);
            }
            uiMap.define(keyCode, keyCodeStr);
            userSettingsUSMap.define(keyCode, usUserSettingsLabel || keyCodeStr);
            userSettingsGeneralMap.define(keyCode, generalUserSettingsLabel || usUserSettingsLabel || keyCodeStr);
        }
        if (eventKeyCode) {
            EVENT_KEY_CODE_MAP[eventKeyCode] = keyCode;
        }
    }
})();
var KeyCodeUtils;
(function (KeyCodeUtils) {
    function toString(keyCode) {
        return uiMap.keyCodeToStr(keyCode);
    }
    KeyCodeUtils.toString = toString;
    function fromString(key) {
        return uiMap.strToKeyCode(key);
    }
    KeyCodeUtils.fromString = fromString;
    function toUserSettingsUS(keyCode) {
        return userSettingsUSMap.keyCodeToStr(keyCode);
    }
    KeyCodeUtils.toUserSettingsUS = toUserSettingsUS;
    function toUserSettingsGeneral(keyCode) {
        return userSettingsGeneralMap.keyCodeToStr(keyCode);
    }
    KeyCodeUtils.toUserSettingsGeneral = toUserSettingsGeneral;
    function fromUserSettings(key) {
        return userSettingsUSMap.strToKeyCode(key) || userSettingsGeneralMap.strToKeyCode(key);
    }
    KeyCodeUtils.fromUserSettings = fromUserSettings;
    function toElectronAccelerator(keyCode) {
        if (keyCode >= 98 /* KeyCode.Numpad0 */ && keyCode <= 113 /* KeyCode.NumpadDivide */) {
            // [Electron Accelerators] Electron is able to parse numpad keys, but unfortunately it
            // renders them just as regular keys in menus. For example, num0 is rendered as "0",
            // numdiv is rendered as "/", numsub is rendered as "-".
            //
            // This can lead to incredible confusion, as it makes numpad based keybindings indistinguishable
            // from keybindings based on regular keys.
            //
            // We therefore need to fall back to custom rendering for numpad keys.
            return null;
        }
        switch (keyCode) {
            case 16 /* KeyCode.UpArrow */:
                return 'Up';
            case 18 /* KeyCode.DownArrow */:
                return 'Down';
            case 15 /* KeyCode.LeftArrow */:
                return 'Left';
            case 17 /* KeyCode.RightArrow */:
                return 'Right';
        }
        return uiMap.keyCodeToStr(keyCode);
    }
    KeyCodeUtils.toElectronAccelerator = toElectronAccelerator;
})(KeyCodeUtils || (KeyCodeUtils = {}));
function KeyChord(firstPart, secondPart) {
    const chordPart = ((secondPart & 0x0000FFFF) << 16) >>> 0;
    return (firstPart | chordPart) >>> 0;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A selection in the editor.
 * The selection is a range that has an orientation.
 */
class Selection extends Range {
    constructor(selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn) {
        super(selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn);
        this.selectionStartLineNumber = selectionStartLineNumber;
        this.selectionStartColumn = selectionStartColumn;
        this.positionLineNumber = positionLineNumber;
        this.positionColumn = positionColumn;
    }
    /**
     * Transform to a human-readable representation.
     */
    toString() {
        return '[' + this.selectionStartLineNumber + ',' + this.selectionStartColumn + ' -> ' + this.positionLineNumber + ',' + this.positionColumn + ']';
    }
    /**
     * Test if equals other selection.
     */
    equalsSelection(other) {
        return (Selection.selectionsEqual(this, other));
    }
    /**
     * Test if the two selections are equal.
     */
    static selectionsEqual(a, b) {
        return (a.selectionStartLineNumber === b.selectionStartLineNumber &&
            a.selectionStartColumn === b.selectionStartColumn &&
            a.positionLineNumber === b.positionLineNumber &&
            a.positionColumn === b.positionColumn);
    }
    /**
     * Get directions (LTR or RTL).
     */
    getDirection() {
        if (this.selectionStartLineNumber === this.startLineNumber && this.selectionStartColumn === this.startColumn) {
            return 0 /* SelectionDirection.LTR */;
        }
        return 1 /* SelectionDirection.RTL */;
    }
    /**
     * Create a new selection with a different `positionLineNumber` and `positionColumn`.
     */
    setEndPosition(endLineNumber, endColumn) {
        if (this.getDirection() === 0 /* SelectionDirection.LTR */) {
            return new Selection(this.startLineNumber, this.startColumn, endLineNumber, endColumn);
        }
        return new Selection(endLineNumber, endColumn, this.startLineNumber, this.startColumn);
    }
    /**
     * Get the position at `positionLineNumber` and `positionColumn`.
     */
    getPosition() {
        return new Position(this.positionLineNumber, this.positionColumn);
    }
    /**
     * Get the position at the start of the selection.
    */
    getSelectionStart() {
        return new Position(this.selectionStartLineNumber, this.selectionStartColumn);
    }
    /**
     * Create a new selection with a different `selectionStartLineNumber` and `selectionStartColumn`.
     */
    setStartPosition(startLineNumber, startColumn) {
        if (this.getDirection() === 0 /* SelectionDirection.LTR */) {
            return new Selection(startLineNumber, startColumn, this.endLineNumber, this.endColumn);
        }
        return new Selection(this.endLineNumber, this.endColumn, startLineNumber, startColumn);
    }
    // ----
    /**
     * Create a `Selection` from one or two positions
     */
    static fromPositions(start, end = start) {
        return new Selection(start.lineNumber, start.column, end.lineNumber, end.column);
    }
    /**
     * Creates a `Selection` from a range, given a direction.
     */
    static fromRange(range, direction) {
        if (direction === 0 /* SelectionDirection.LTR */) {
            return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
        }
        else {
            return new Selection(range.endLineNumber, range.endColumn, range.startLineNumber, range.startColumn);
        }
    }
    /**
     * Create a `Selection` from an `ISelection`.
     */
    static liftSelection(sel) {
        return new Selection(sel.selectionStartLineNumber, sel.selectionStartColumn, sel.positionLineNumber, sel.positionColumn);
    }
    /**
     * `a` equals `b`.
     */
    static selectionsArrEqual(a, b) {
        if (a && !b || !a && b) {
            return false;
        }
        if (!a && !b) {
            return true;
        }
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, len = a.length; i < len; i++) {
            if (!this.selectionsEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    /**
     * Test if `obj` is an `ISelection`.
     */
    static isISelection(obj) {
        return (obj
            && (typeof obj.selectionStartLineNumber === 'number')
            && (typeof obj.selectionStartColumn === 'number')
            && (typeof obj.positionLineNumber === 'number')
            && (typeof obj.positionColumn === 'number'));
    }
    /**
     * Create with a direction.
     */
    static createWithDirection(startLineNumber, startColumn, endLineNumber, endColumn, direction) {
        if (direction === 0 /* SelectionDirection.LTR */) {
            return new Selection(startLineNumber, startColumn, endLineNumber, endColumn);
        }
        return new Selection(endLineNumber, endColumn, startLineNumber, startColumn);
    }
}

const _codiconFontCharacters = Object.create(null);
function register(id, fontCharacter) {
    if (isString(fontCharacter)) {
        const val = _codiconFontCharacters[fontCharacter];
        if (val === undefined) {
            throw new Error(`${id} references an unknown codicon: ${fontCharacter}`);
        }
        fontCharacter = val;
    }
    _codiconFontCharacters[id] = fontCharacter;
    return { id };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// This file is automatically generated by (microsoft/vscode-codicons)/scripts/export-to-ts.js
// Please don't edit it, as your changes will be overwritten.
// Instead, add mappings to codiconsDerived in codicons.ts.
const codiconsLibrary = {
    add: register('add', 0xea60),
    plus: register('plus', 0xea60),
    gistNew: register('gist-new', 0xea60),
    repoCreate: register('repo-create', 0xea60),
    lightbulb: register('lightbulb', 0xea61),
    lightBulb: register('light-bulb', 0xea61),
    repo: register('repo', 0xea62),
    repoDelete: register('repo-delete', 0xea62),
    gistFork: register('gist-fork', 0xea63),
    repoForked: register('repo-forked', 0xea63),
    gitPullRequest: register('git-pull-request', 0xea64),
    gitPullRequestAbandoned: register('git-pull-request-abandoned', 0xea64),
    recordKeys: register('record-keys', 0xea65),
    keyboard: register('keyboard', 0xea65),
    tag: register('tag', 0xea66),
    gitPullRequestLabel: register('git-pull-request-label', 0xea66),
    tagAdd: register('tag-add', 0xea66),
    tagRemove: register('tag-remove', 0xea66),
    person: register('person', 0xea67),
    personFollow: register('person-follow', 0xea67),
    personOutline: register('person-outline', 0xea67),
    personFilled: register('person-filled', 0xea67),
    gitBranch: register('git-branch', 0xea68),
    gitBranchCreate: register('git-branch-create', 0xea68),
    gitBranchDelete: register('git-branch-delete', 0xea68),
    sourceControl: register('source-control', 0xea68),
    mirror: register('mirror', 0xea69),
    mirrorPublic: register('mirror-public', 0xea69),
    star: register('star', 0xea6a),
    starAdd: register('star-add', 0xea6a),
    starDelete: register('star-delete', 0xea6a),
    starEmpty: register('star-empty', 0xea6a),
    comment: register('comment', 0xea6b),
    commentAdd: register('comment-add', 0xea6b),
    alert: register('alert', 0xea6c),
    warning: register('warning', 0xea6c),
    search: register('search', 0xea6d),
    searchSave: register('search-save', 0xea6d),
    logOut: register('log-out', 0xea6e),
    signOut: register('sign-out', 0xea6e),
    logIn: register('log-in', 0xea6f),
    signIn: register('sign-in', 0xea6f),
    eye: register('eye', 0xea70),
    eyeUnwatch: register('eye-unwatch', 0xea70),
    eyeWatch: register('eye-watch', 0xea70),
    circleFilled: register('circle-filled', 0xea71),
    primitiveDot: register('primitive-dot', 0xea71),
    closeDirty: register('close-dirty', 0xea71),
    debugBreakpoint: register('debug-breakpoint', 0xea71),
    debugBreakpointDisabled: register('debug-breakpoint-disabled', 0xea71),
    debugHint: register('debug-hint', 0xea71),
    terminalDecorationSuccess: register('terminal-decoration-success', 0xea71),
    primitiveSquare: register('primitive-square', 0xea72),
    edit: register('edit', 0xea73),
    pencil: register('pencil', 0xea73),
    info: register('info', 0xea74),
    issueOpened: register('issue-opened', 0xea74),
    gistPrivate: register('gist-private', 0xea75),
    gitForkPrivate: register('git-fork-private', 0xea75),
    lock: register('lock', 0xea75),
    mirrorPrivate: register('mirror-private', 0xea75),
    close: register('close', 0xea76),
    removeClose: register('remove-close', 0xea76),
    x: register('x', 0xea76),
    repoSync: register('repo-sync', 0xea77),
    sync: register('sync', 0xea77),
    clone: register('clone', 0xea78),
    desktopDownload: register('desktop-download', 0xea78),
    beaker: register('beaker', 0xea79),
    microscope: register('microscope', 0xea79),
    vm: register('vm', 0xea7a),
    deviceDesktop: register('device-desktop', 0xea7a),
    file: register('file', 0xea7b),
    fileText: register('file-text', 0xea7b),
    more: register('more', 0xea7c),
    ellipsis: register('ellipsis', 0xea7c),
    kebabHorizontal: register('kebab-horizontal', 0xea7c),
    mailReply: register('mail-reply', 0xea7d),
    reply: register('reply', 0xea7d),
    organization: register('organization', 0xea7e),
    organizationFilled: register('organization-filled', 0xea7e),
    organizationOutline: register('organization-outline', 0xea7e),
    newFile: register('new-file', 0xea7f),
    fileAdd: register('file-add', 0xea7f),
    newFolder: register('new-folder', 0xea80),
    fileDirectoryCreate: register('file-directory-create', 0xea80),
    trash: register('trash', 0xea81),
    trashcan: register('trashcan', 0xea81),
    history: register('history', 0xea82),
    clock: register('clock', 0xea82),
    folder: register('folder', 0xea83),
    fileDirectory: register('file-directory', 0xea83),
    symbolFolder: register('symbol-folder', 0xea83),
    logoGithub: register('logo-github', 0xea84),
    markGithub: register('mark-github', 0xea84),
    github: register('github', 0xea84),
    terminal: register('terminal', 0xea85),
    console: register('console', 0xea85),
    repl: register('repl', 0xea85),
    zap: register('zap', 0xea86),
    symbolEvent: register('symbol-event', 0xea86),
    error: register('error', 0xea87),
    stop: register('stop', 0xea87),
    variable: register('variable', 0xea88),
    symbolVariable: register('symbol-variable', 0xea88),
    array: register('array', 0xea8a),
    symbolArray: register('symbol-array', 0xea8a),
    symbolModule: register('symbol-module', 0xea8b),
    symbolPackage: register('symbol-package', 0xea8b),
    symbolNamespace: register('symbol-namespace', 0xea8b),
    symbolObject: register('symbol-object', 0xea8b),
    symbolMethod: register('symbol-method', 0xea8c),
    symbolFunction: register('symbol-function', 0xea8c),
    symbolConstructor: register('symbol-constructor', 0xea8c),
    symbolBoolean: register('symbol-boolean', 0xea8f),
    symbolNull: register('symbol-null', 0xea8f),
    symbolNumeric: register('symbol-numeric', 0xea90),
    symbolNumber: register('symbol-number', 0xea90),
    symbolStructure: register('symbol-structure', 0xea91),
    symbolStruct: register('symbol-struct', 0xea91),
    symbolParameter: register('symbol-parameter', 0xea92),
    symbolTypeParameter: register('symbol-type-parameter', 0xea92),
    symbolKey: register('symbol-key', 0xea93),
    symbolText: register('symbol-text', 0xea93),
    symbolReference: register('symbol-reference', 0xea94),
    goToFile: register('go-to-file', 0xea94),
    symbolEnum: register('symbol-enum', 0xea95),
    symbolValue: register('symbol-value', 0xea95),
    symbolRuler: register('symbol-ruler', 0xea96),
    symbolUnit: register('symbol-unit', 0xea96),
    activateBreakpoints: register('activate-breakpoints', 0xea97),
    archive: register('archive', 0xea98),
    arrowBoth: register('arrow-both', 0xea99),
    arrowDown: register('arrow-down', 0xea9a),
    arrowLeft: register('arrow-left', 0xea9b),
    arrowRight: register('arrow-right', 0xea9c),
    arrowSmallDown: register('arrow-small-down', 0xea9d),
    arrowSmallLeft: register('arrow-small-left', 0xea9e),
    arrowSmallRight: register('arrow-small-right', 0xea9f),
    arrowSmallUp: register('arrow-small-up', 0xeaa0),
    arrowUp: register('arrow-up', 0xeaa1),
    bell: register('bell', 0xeaa2),
    bold: register('bold', 0xeaa3),
    book: register('book', 0xeaa4),
    bookmark: register('bookmark', 0xeaa5),
    debugBreakpointConditionalUnverified: register('debug-breakpoint-conditional-unverified', 0xeaa6),
    debugBreakpointConditional: register('debug-breakpoint-conditional', 0xeaa7),
    debugBreakpointConditionalDisabled: register('debug-breakpoint-conditional-disabled', 0xeaa7),
    debugBreakpointDataUnverified: register('debug-breakpoint-data-unverified', 0xeaa8),
    debugBreakpointData: register('debug-breakpoint-data', 0xeaa9),
    debugBreakpointDataDisabled: register('debug-breakpoint-data-disabled', 0xeaa9),
    debugBreakpointLogUnverified: register('debug-breakpoint-log-unverified', 0xeaaa),
    debugBreakpointLog: register('debug-breakpoint-log', 0xeaab),
    debugBreakpointLogDisabled: register('debug-breakpoint-log-disabled', 0xeaab),
    briefcase: register('briefcase', 0xeaac),
    broadcast: register('broadcast', 0xeaad),
    browser: register('browser', 0xeaae),
    bug: register('bug', 0xeaaf),
    calendar: register('calendar', 0xeab0),
    caseSensitive: register('case-sensitive', 0xeab1),
    check: register('check', 0xeab2),
    checklist: register('checklist', 0xeab3),
    chevronDown: register('chevron-down', 0xeab4),
    chevronLeft: register('chevron-left', 0xeab5),
    chevronRight: register('chevron-right', 0xeab6),
    chevronUp: register('chevron-up', 0xeab7),
    chromeClose: register('chrome-close', 0xeab8),
    chromeMaximize: register('chrome-maximize', 0xeab9),
    chromeMinimize: register('chrome-minimize', 0xeaba),
    chromeRestore: register('chrome-restore', 0xeabb),
    circleOutline: register('circle-outline', 0xeabc),
    circle: register('circle', 0xeabc),
    debugBreakpointUnverified: register('debug-breakpoint-unverified', 0xeabc),
    terminalDecorationIncomplete: register('terminal-decoration-incomplete', 0xeabc),
    circleSlash: register('circle-slash', 0xeabd),
    circuitBoard: register('circuit-board', 0xeabe),
    clearAll: register('clear-all', 0xeabf),
    clippy: register('clippy', 0xeac0),
    closeAll: register('close-all', 0xeac1),
    cloudDownload: register('cloud-download', 0xeac2),
    cloudUpload: register('cloud-upload', 0xeac3),
    code: register('code', 0xeac4),
    collapseAll: register('collapse-all', 0xeac5),
    colorMode: register('color-mode', 0xeac6),
    commentDiscussion: register('comment-discussion', 0xeac7),
    creditCard: register('credit-card', 0xeac9),
    dash: register('dash', 0xeacc),
    dashboard: register('dashboard', 0xeacd),
    database: register('database', 0xeace),
    debugContinue: register('debug-continue', 0xeacf),
    debugDisconnect: register('debug-disconnect', 0xead0),
    debugPause: register('debug-pause', 0xead1),
    debugRestart: register('debug-restart', 0xead2),
    debugStart: register('debug-start', 0xead3),
    debugStepInto: register('debug-step-into', 0xead4),
    debugStepOut: register('debug-step-out', 0xead5),
    debugStepOver: register('debug-step-over', 0xead6),
    debugStop: register('debug-stop', 0xead7),
    debug: register('debug', 0xead8),
    deviceCameraVideo: register('device-camera-video', 0xead9),
    deviceCamera: register('device-camera', 0xeada),
    deviceMobile: register('device-mobile', 0xeadb),
    diffAdded: register('diff-added', 0xeadc),
    diffIgnored: register('diff-ignored', 0xeadd),
    diffModified: register('diff-modified', 0xeade),
    diffRemoved: register('diff-removed', 0xeadf),
    diffRenamed: register('diff-renamed', 0xeae0),
    diff: register('diff', 0xeae1),
    diffSidebyside: register('diff-sidebyside', 0xeae1),
    discard: register('discard', 0xeae2),
    editorLayout: register('editor-layout', 0xeae3),
    emptyWindow: register('empty-window', 0xeae4),
    exclude: register('exclude', 0xeae5),
    extensions: register('extensions', 0xeae6),
    eyeClosed: register('eye-closed', 0xeae7),
    fileBinary: register('file-binary', 0xeae8),
    fileCode: register('file-code', 0xeae9),
    fileMedia: register('file-media', 0xeaea),
    filePdf: register('file-pdf', 0xeaeb),
    fileSubmodule: register('file-submodule', 0xeaec),
    fileSymlinkDirectory: register('file-symlink-directory', 0xeaed),
    fileSymlinkFile: register('file-symlink-file', 0xeaee),
    fileZip: register('file-zip', 0xeaef),
    files: register('files', 0xeaf0),
    filter: register('filter', 0xeaf1),
    flame: register('flame', 0xeaf2),
    foldDown: register('fold-down', 0xeaf3),
    foldUp: register('fold-up', 0xeaf4),
    fold: register('fold', 0xeaf5),
    folderActive: register('folder-active', 0xeaf6),
    folderOpened: register('folder-opened', 0xeaf7),
    gear: register('gear', 0xeaf8),
    gift: register('gift', 0xeaf9),
    gistSecret: register('gist-secret', 0xeafa),
    gist: register('gist', 0xeafb),
    gitCommit: register('git-commit', 0xeafc),
    gitCompare: register('git-compare', 0xeafd),
    compareChanges: register('compare-changes', 0xeafd),
    gitMerge: register('git-merge', 0xeafe),
    githubAction: register('github-action', 0xeaff),
    githubAlt: register('github-alt', 0xeb00),
    globe: register('globe', 0xeb01),
    grabber: register('grabber', 0xeb02),
    graph: register('graph', 0xeb03),
    gripper: register('gripper', 0xeb04),
    heart: register('heart', 0xeb05),
    home: register('home', 0xeb06),
    horizontalRule: register('horizontal-rule', 0xeb07),
    hubot: register('hubot', 0xeb08),
    inbox: register('inbox', 0xeb09),
    issueReopened: register('issue-reopened', 0xeb0b),
    issues: register('issues', 0xeb0c),
    italic: register('italic', 0xeb0d),
    jersey: register('jersey', 0xeb0e),
    json: register('json', 0xeb0f),
    kebabVertical: register('kebab-vertical', 0xeb10),
    key: register('key', 0xeb11),
    law: register('law', 0xeb12),
    lightbulbAutofix: register('lightbulb-autofix', 0xeb13),
    linkExternal: register('link-external', 0xeb14),
    link: register('link', 0xeb15),
    listOrdered: register('list-ordered', 0xeb16),
    listUnordered: register('list-unordered', 0xeb17),
    liveShare: register('live-share', 0xeb18),
    loading: register('loading', 0xeb19),
    location: register('location', 0xeb1a),
    mailRead: register('mail-read', 0xeb1b),
    mail: register('mail', 0xeb1c),
    markdown: register('markdown', 0xeb1d),
    megaphone: register('megaphone', 0xeb1e),
    mention: register('mention', 0xeb1f),
    milestone: register('milestone', 0xeb20),
    gitPullRequestMilestone: register('git-pull-request-milestone', 0xeb20),
    mortarBoard: register('mortar-board', 0xeb21),
    move: register('move', 0xeb22),
    multipleWindows: register('multiple-windows', 0xeb23),
    mute: register('mute', 0xeb24),
    noNewline: register('no-newline', 0xeb25),
    note: register('note', 0xeb26),
    octoface: register('octoface', 0xeb27),
    openPreview: register('open-preview', 0xeb28),
    package: register('package', 0xeb29),
    paintcan: register('paintcan', 0xeb2a),
    pin: register('pin', 0xeb2b),
    play: register('play', 0xeb2c),
    run: register('run', 0xeb2c),
    plug: register('plug', 0xeb2d),
    preserveCase: register('preserve-case', 0xeb2e),
    preview: register('preview', 0xeb2f),
    project: register('project', 0xeb30),
    pulse: register('pulse', 0xeb31),
    question: register('question', 0xeb32),
    quote: register('quote', 0xeb33),
    radioTower: register('radio-tower', 0xeb34),
    reactions: register('reactions', 0xeb35),
    references: register('references', 0xeb36),
    refresh: register('refresh', 0xeb37),
    regex: register('regex', 0xeb38),
    remoteExplorer: register('remote-explorer', 0xeb39),
    remote: register('remote', 0xeb3a),
    remove: register('remove', 0xeb3b),
    replaceAll: register('replace-all', 0xeb3c),
    replace: register('replace', 0xeb3d),
    repoClone: register('repo-clone', 0xeb3e),
    repoForcePush: register('repo-force-push', 0xeb3f),
    repoPull: register('repo-pull', 0xeb40),
    repoPush: register('repo-push', 0xeb41),
    report: register('report', 0xeb42),
    requestChanges: register('request-changes', 0xeb43),
    rocket: register('rocket', 0xeb44),
    rootFolderOpened: register('root-folder-opened', 0xeb45),
    rootFolder: register('root-folder', 0xeb46),
    rss: register('rss', 0xeb47),
    ruby: register('ruby', 0xeb48),
    saveAll: register('save-all', 0xeb49),
    saveAs: register('save-as', 0xeb4a),
    save: register('save', 0xeb4b),
    screenFull: register('screen-full', 0xeb4c),
    screenNormal: register('screen-normal', 0xeb4d),
    searchStop: register('search-stop', 0xeb4e),
    server: register('server', 0xeb50),
    settingsGear: register('settings-gear', 0xeb51),
    settings: register('settings', 0xeb52),
    shield: register('shield', 0xeb53),
    smiley: register('smiley', 0xeb54),
    sortPrecedence: register('sort-precedence', 0xeb55),
    splitHorizontal: register('split-horizontal', 0xeb56),
    splitVertical: register('split-vertical', 0xeb57),
    squirrel: register('squirrel', 0xeb58),
    starFull: register('star-full', 0xeb59),
    starHalf: register('star-half', 0xeb5a),
    symbolClass: register('symbol-class', 0xeb5b),
    symbolColor: register('symbol-color', 0xeb5c),
    symbolConstant: register('symbol-constant', 0xeb5d),
    symbolEnumMember: register('symbol-enum-member', 0xeb5e),
    symbolField: register('symbol-field', 0xeb5f),
    symbolFile: register('symbol-file', 0xeb60),
    symbolInterface: register('symbol-interface', 0xeb61),
    symbolKeyword: register('symbol-keyword', 0xeb62),
    symbolMisc: register('symbol-misc', 0xeb63),
    symbolOperator: register('symbol-operator', 0xeb64),
    symbolProperty: register('symbol-property', 0xeb65),
    wrench: register('wrench', 0xeb65),
    wrenchSubaction: register('wrench-subaction', 0xeb65),
    symbolSnippet: register('symbol-snippet', 0xeb66),
    tasklist: register('tasklist', 0xeb67),
    telescope: register('telescope', 0xeb68),
    textSize: register('text-size', 0xeb69),
    threeBars: register('three-bars', 0xeb6a),
    thumbsdown: register('thumbsdown', 0xeb6b),
    thumbsup: register('thumbsup', 0xeb6c),
    tools: register('tools', 0xeb6d),
    triangleDown: register('triangle-down', 0xeb6e),
    triangleLeft: register('triangle-left', 0xeb6f),
    triangleRight: register('triangle-right', 0xeb70),
    triangleUp: register('triangle-up', 0xeb71),
    twitter: register('twitter', 0xeb72),
    unfold: register('unfold', 0xeb73),
    unlock: register('unlock', 0xeb74),
    unmute: register('unmute', 0xeb75),
    unverified: register('unverified', 0xeb76),
    verified: register('verified', 0xeb77),
    versions: register('versions', 0xeb78),
    vmActive: register('vm-active', 0xeb79),
    vmOutline: register('vm-outline', 0xeb7a),
    vmRunning: register('vm-running', 0xeb7b),
    watch: register('watch', 0xeb7c),
    whitespace: register('whitespace', 0xeb7d),
    wholeWord: register('whole-word', 0xeb7e),
    window: register('window', 0xeb7f),
    wordWrap: register('word-wrap', 0xeb80),
    zoomIn: register('zoom-in', 0xeb81),
    zoomOut: register('zoom-out', 0xeb82),
    listFilter: register('list-filter', 0xeb83),
    listFlat: register('list-flat', 0xeb84),
    listSelection: register('list-selection', 0xeb85),
    selection: register('selection', 0xeb85),
    listTree: register('list-tree', 0xeb86),
    debugBreakpointFunctionUnverified: register('debug-breakpoint-function-unverified', 0xeb87),
    debugBreakpointFunction: register('debug-breakpoint-function', 0xeb88),
    debugBreakpointFunctionDisabled: register('debug-breakpoint-function-disabled', 0xeb88),
    debugStackframeActive: register('debug-stackframe-active', 0xeb89),
    circleSmallFilled: register('circle-small-filled', 0xeb8a),
    debugStackframeDot: register('debug-stackframe-dot', 0xeb8a),
    terminalDecorationMark: register('terminal-decoration-mark', 0xeb8a),
    debugStackframe: register('debug-stackframe', 0xeb8b),
    debugStackframeFocused: register('debug-stackframe-focused', 0xeb8b),
    debugBreakpointUnsupported: register('debug-breakpoint-unsupported', 0xeb8c),
    symbolString: register('symbol-string', 0xeb8d),
    debugReverseContinue: register('debug-reverse-continue', 0xeb8e),
    debugStepBack: register('debug-step-back', 0xeb8f),
    debugRestartFrame: register('debug-restart-frame', 0xeb90),
    debugAlt: register('debug-alt', 0xeb91),
    callIncoming: register('call-incoming', 0xeb92),
    callOutgoing: register('call-outgoing', 0xeb93),
    menu: register('menu', 0xeb94),
    expandAll: register('expand-all', 0xeb95),
    feedback: register('feedback', 0xeb96),
    gitPullRequestReviewer: register('git-pull-request-reviewer', 0xeb96),
    groupByRefType: register('group-by-ref-type', 0xeb97),
    ungroupByRefType: register('ungroup-by-ref-type', 0xeb98),
    account: register('account', 0xeb99),
    gitPullRequestAssignee: register('git-pull-request-assignee', 0xeb99),
    bellDot: register('bell-dot', 0xeb9a),
    debugConsole: register('debug-console', 0xeb9b),
    library: register('library', 0xeb9c),
    output: register('output', 0xeb9d),
    runAll: register('run-all', 0xeb9e),
    syncIgnored: register('sync-ignored', 0xeb9f),
    pinned: register('pinned', 0xeba0),
    githubInverted: register('github-inverted', 0xeba1),
    serverProcess: register('server-process', 0xeba2),
    serverEnvironment: register('server-environment', 0xeba3),
    pass: register('pass', 0xeba4),
    issueClosed: register('issue-closed', 0xeba4),
    stopCircle: register('stop-circle', 0xeba5),
    playCircle: register('play-circle', 0xeba6),
    record: register('record', 0xeba7),
    debugAltSmall: register('debug-alt-small', 0xeba8),
    vmConnect: register('vm-connect', 0xeba9),
    cloud: register('cloud', 0xebaa),
    merge: register('merge', 0xebab),
    export: register('export', 0xebac),
    graphLeft: register('graph-left', 0xebad),
    magnet: register('magnet', 0xebae),
    notebook: register('notebook', 0xebaf),
    redo: register('redo', 0xebb0),
    checkAll: register('check-all', 0xebb1),
    pinnedDirty: register('pinned-dirty', 0xebb2),
    passFilled: register('pass-filled', 0xebb3),
    circleLargeFilled: register('circle-large-filled', 0xebb4),
    circleLarge: register('circle-large', 0xebb5),
    circleLargeOutline: register('circle-large-outline', 0xebb5),
    combine: register('combine', 0xebb6),
    gather: register('gather', 0xebb6),
    table: register('table', 0xebb7),
    variableGroup: register('variable-group', 0xebb8),
    typeHierarchy: register('type-hierarchy', 0xebb9),
    typeHierarchySub: register('type-hierarchy-sub', 0xebba),
    typeHierarchySuper: register('type-hierarchy-super', 0xebbb),
    gitPullRequestCreate: register('git-pull-request-create', 0xebbc),
    runAbove: register('run-above', 0xebbd),
    runBelow: register('run-below', 0xebbe),
    notebookTemplate: register('notebook-template', 0xebbf),
    debugRerun: register('debug-rerun', 0xebc0),
    workspaceTrusted: register('workspace-trusted', 0xebc1),
    workspaceUntrusted: register('workspace-untrusted', 0xebc2),
    workspaceUnknown: register('workspace-unknown', 0xebc3),
    terminalCmd: register('terminal-cmd', 0xebc4),
    terminalDebian: register('terminal-debian', 0xebc5),
    terminalLinux: register('terminal-linux', 0xebc6),
    terminalPowershell: register('terminal-powershell', 0xebc7),
    terminalTmux: register('terminal-tmux', 0xebc8),
    terminalUbuntu: register('terminal-ubuntu', 0xebc9),
    terminalBash: register('terminal-bash', 0xebca),
    arrowSwap: register('arrow-swap', 0xebcb),
    copy: register('copy', 0xebcc),
    personAdd: register('person-add', 0xebcd),
    filterFilled: register('filter-filled', 0xebce),
    wand: register('wand', 0xebcf),
    debugLineByLine: register('debug-line-by-line', 0xebd0),
    inspect: register('inspect', 0xebd1),
    layers: register('layers', 0xebd2),
    layersDot: register('layers-dot', 0xebd3),
    layersActive: register('layers-active', 0xebd4),
    compass: register('compass', 0xebd5),
    compassDot: register('compass-dot', 0xebd6),
    compassActive: register('compass-active', 0xebd7),
    azure: register('azure', 0xebd8),
    issueDraft: register('issue-draft', 0xebd9),
    gitPullRequestClosed: register('git-pull-request-closed', 0xebda),
    gitPullRequestDraft: register('git-pull-request-draft', 0xebdb),
    debugAll: register('debug-all', 0xebdc),
    debugCoverage: register('debug-coverage', 0xebdd),
    runErrors: register('run-errors', 0xebde),
    folderLibrary: register('folder-library', 0xebdf),
    debugContinueSmall: register('debug-continue-small', 0xebe0),
    beakerStop: register('beaker-stop', 0xebe1),
    graphLine: register('graph-line', 0xebe2),
    graphScatter: register('graph-scatter', 0xebe3),
    pieChart: register('pie-chart', 0xebe4),
    bracket: register('bracket', 0xeb0f),
    bracketDot: register('bracket-dot', 0xebe5),
    bracketError: register('bracket-error', 0xebe6),
    lockSmall: register('lock-small', 0xebe7),
    azureDevops: register('azure-devops', 0xebe8),
    verifiedFilled: register('verified-filled', 0xebe9),
    newline: register('newline', 0xebea),
    layout: register('layout', 0xebeb),
    layoutActivitybarLeft: register('layout-activitybar-left', 0xebec),
    layoutActivitybarRight: register('layout-activitybar-right', 0xebed),
    layoutPanelLeft: register('layout-panel-left', 0xebee),
    layoutPanelCenter: register('layout-panel-center', 0xebef),
    layoutPanelJustify: register('layout-panel-justify', 0xebf0),
    layoutPanelRight: register('layout-panel-right', 0xebf1),
    layoutPanel: register('layout-panel', 0xebf2),
    layoutSidebarLeft: register('layout-sidebar-left', 0xebf3),
    layoutSidebarRight: register('layout-sidebar-right', 0xebf4),
    layoutStatusbar: register('layout-statusbar', 0xebf5),
    layoutMenubar: register('layout-menubar', 0xebf6),
    layoutCentered: register('layout-centered', 0xebf7),
    target: register('target', 0xebf8),
    indent: register('indent', 0xebf9),
    recordSmall: register('record-small', 0xebfa),
    errorSmall: register('error-small', 0xebfb),
    terminalDecorationError: register('terminal-decoration-error', 0xebfb),
    arrowCircleDown: register('arrow-circle-down', 0xebfc),
    arrowCircleLeft: register('arrow-circle-left', 0xebfd),
    arrowCircleRight: register('arrow-circle-right', 0xebfe),
    arrowCircleUp: register('arrow-circle-up', 0xebff),
    layoutSidebarRightOff: register('layout-sidebar-right-off', 0xec00),
    layoutPanelOff: register('layout-panel-off', 0xec01),
    layoutSidebarLeftOff: register('layout-sidebar-left-off', 0xec02),
    blank: register('blank', 0xec03),
    heartFilled: register('heart-filled', 0xec04),
    map: register('map', 0xec05),
    mapHorizontal: register('map-horizontal', 0xec05),
    foldHorizontal: register('fold-horizontal', 0xec05),
    mapFilled: register('map-filled', 0xec06),
    mapHorizontalFilled: register('map-horizontal-filled', 0xec06),
    foldHorizontalFilled: register('fold-horizontal-filled', 0xec06),
    circleSmall: register('circle-small', 0xec07),
    bellSlash: register('bell-slash', 0xec08),
    bellSlashDot: register('bell-slash-dot', 0xec09),
    commentUnresolved: register('comment-unresolved', 0xec0a),
    gitPullRequestGoToChanges: register('git-pull-request-go-to-changes', 0xec0b),
    gitPullRequestNewChanges: register('git-pull-request-new-changes', 0xec0c),
    searchFuzzy: register('search-fuzzy', 0xec0d),
    commentDraft: register('comment-draft', 0xec0e),
    send: register('send', 0xec0f),
    sparkle: register('sparkle', 0xec10),
    insert: register('insert', 0xec11),
    mic: register('mic', 0xec12),
    thumbsdownFilled: register('thumbsdown-filled', 0xec13),
    thumbsupFilled: register('thumbsup-filled', 0xec14),
    coffee: register('coffee', 0xec15),
    snake: register('snake', 0xec16),
    game: register('game', 0xec17),
    vr: register('vr', 0xec18),
    chip: register('chip', 0xec19),
    piano: register('piano', 0xec1a),
    music: register('music', 0xec1b),
    micFilled: register('mic-filled', 0xec1c),
    repoFetch: register('repo-fetch', 0xec1d),
    copilot: register('copilot', 0xec1e),
    lightbulbSparkle: register('lightbulb-sparkle', 0xec1f),
    robot: register('robot', 0xec20),
    sparkleFilled: register('sparkle-filled', 0xec21),
    diffSingle: register('diff-single', 0xec22),
    diffMultiple: register('diff-multiple', 0xec23),
    surroundWith: register('surround-with', 0xec24),
    share: register('share', 0xec25),
    gitStash: register('git-stash', 0xec26),
    gitStashApply: register('git-stash-apply', 0xec27),
    gitStashPop: register('git-stash-pop', 0xec28),
    vscode: register('vscode', 0xec29),
    vscodeInsiders: register('vscode-insiders', 0xec2a),
    codeOss: register('code-oss', 0xec2b),
    runCoverage: register('run-coverage', 0xec2c),
    runAllCoverage: register('run-all-coverage', 0xec2d),
    coverage: register('coverage', 0xec2e),
    githubProject: register('github-project', 0xec2f),
    mapVertical: register('map-vertical', 0xec30),
    foldVertical: register('fold-vertical', 0xec30),
    mapVerticalFilled: register('map-vertical-filled', 0xec31),
    foldVerticalFilled: register('fold-vertical-filled', 0xec31),
    goToSearch: register('go-to-search', 0xec32),
    percentage: register('percentage', 0xec33),
    sortPercentage: register('sort-percentage', 0xec33),
    attach: register('attach', 0xec34),
};

/**
 * Derived icons, that could become separate icons.
 * These mappings should be moved into the mapping file in the vscode-codicons repo at some point.
 */
const codiconsDerived = {
    dialogError: register('dialog-error', 'error'),
    dialogWarning: register('dialog-warning', 'warning'),
    dialogInfo: register('dialog-info', 'info'),
    dialogClose: register('dialog-close', 'close'),
    treeItemExpanded: register('tree-item-expanded', 'chevron-down'), // collapsed is done with rotation
    treeFilterOnTypeOn: register('tree-filter-on-type-on', 'list-filter'),
    treeFilterOnTypeOff: register('tree-filter-on-type-off', 'list-selection'),
    treeFilterClear: register('tree-filter-clear', 'close'),
    treeItemLoading: register('tree-item-loading', 'loading'),
    menuSelection: register('menu-selection', 'check'),
    menuSubmenu: register('menu-submenu', 'chevron-right'),
    menuBarMore: register('menubar-more', 'more'),
    scrollbarButtonLeft: register('scrollbar-button-left', 'triangle-left'),
    scrollbarButtonRight: register('scrollbar-button-right', 'triangle-right'),
    scrollbarButtonUp: register('scrollbar-button-up', 'triangle-up'),
    scrollbarButtonDown: register('scrollbar-button-down', 'triangle-down'),
    toolBarMore: register('toolbar-more', 'more'),
    quickInputBack: register('quick-input-back', 'arrow-left'),
    dropDownButton: register('drop-down-button', 0xeab4),
    symbolCustomColor: register('symbol-customcolor', 0xeb5c),
    exportIcon: register('export', 0xebac),
    workspaceUnspecified: register('workspace-unspecified', 0xebc3),
    newLine: register('newline', 0xebea),
    thumbsDownFilled: register('thumbsdown-filled', 0xec13),
    thumbsUpFilled: register('thumbsup-filled', 0xec14),
    gitFetch: register('git-fetch', 0xec1d),
    lightbulbSparkleAutofix: register('lightbulb-sparkle-autofix', 0xec1f),
    debugBreakpointPending: register('debug-breakpoint-pending', 0xebd9),
};
/**
 * The Codicon library is a set of default icons that are built-in in VS Code.
 *
 * In the product (outside of base) Codicons should only be used as defaults. In order to have all icons in VS Code
 * themeable, component should define new, UI component specific icons using `iconRegistry.registerIcon`.
 * In that call a Codicon can be named as default.
 */
const Codicon = {
    ...codiconsLibrary,
    ...codiconsDerived
};

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class TokenizationRegistry {
    constructor() {
        this._tokenizationSupports = new Map();
        this._factories = new Map();
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
        this._colorMap = null;
    }
    handleChange(languageIds) {
        this._onDidChange.fire({
            changedLanguages: languageIds,
            changedColorMap: false
        });
    }
    register(languageId, support) {
        this._tokenizationSupports.set(languageId, support);
        this.handleChange([languageId]);
        return toDisposable(() => {
            if (this._tokenizationSupports.get(languageId) !== support) {
                return;
            }
            this._tokenizationSupports.delete(languageId);
            this.handleChange([languageId]);
        });
    }
    get(languageId) {
        return this._tokenizationSupports.get(languageId) || null;
    }
    registerFactory(languageId, factory) {
        var _a;
        (_a = this._factories.get(languageId)) === null || _a === void 0 ? void 0 : _a.dispose();
        const myData = new TokenizationSupportFactoryData(this, languageId, factory);
        this._factories.set(languageId, myData);
        return toDisposable(() => {
            const v = this._factories.get(languageId);
            if (!v || v !== myData) {
                return;
            }
            this._factories.delete(languageId);
            v.dispose();
        });
    }
    async getOrCreate(languageId) {
        // check first if the support is already set
        const tokenizationSupport = this.get(languageId);
        if (tokenizationSupport) {
            return tokenizationSupport;
        }
        const factory = this._factories.get(languageId);
        if (!factory || factory.isResolved) {
            // no factory or factory.resolve already finished
            return null;
        }
        await factory.resolve();
        return this.get(languageId);
    }
    isResolved(languageId) {
        const tokenizationSupport = this.get(languageId);
        if (tokenizationSupport) {
            return true;
        }
        const factory = this._factories.get(languageId);
        if (!factory || factory.isResolved) {
            return true;
        }
        return false;
    }
    setColorMap(colorMap) {
        this._colorMap = colorMap;
        this._onDidChange.fire({
            changedLanguages: Array.from(this._tokenizationSupports.keys()),
            changedColorMap: true
        });
    }
    getColorMap() {
        return this._colorMap;
    }
    getDefaultBackground() {
        if (this._colorMap && this._colorMap.length > 2 /* ColorId.DefaultBackground */) {
            return this._colorMap[2 /* ColorId.DefaultBackground */];
        }
        return null;
    }
}
class TokenizationSupportFactoryData extends Disposable {
    get isResolved() {
        return this._isResolved;
    }
    constructor(_registry, _languageId, _factory) {
        super();
        this._registry = _registry;
        this._languageId = _languageId;
        this._factory = _factory;
        this._isDisposed = false;
        this._resolvePromise = null;
        this._isResolved = false;
    }
    dispose() {
        this._isDisposed = true;
        super.dispose();
    }
    async resolve() {
        if (!this._resolvePromise) {
            this._resolvePromise = this._create();
        }
        return this._resolvePromise;
    }
    async _create() {
        const value = await this._factory.tokenizationSupport;
        this._isResolved = true;
        if (value && !this._isDisposed) {
            this._register(this._registry.register(this._languageId, value));
        }
    }
}

class Token {
    constructor(offset, type, language) {
        this.offset = offset;
        this.type = type;
        this.language = language;
        this._tokenBrand = undefined;
    }
    toString() {
        return '(' + this.offset + ', ' + this.type + ')';
    }
}
var HoverVerbosityAction$1;
(function (HoverVerbosityAction) {
    /**
     * Increase the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Increase"] = 0] = "Increase";
    /**
     * Decrease the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Decrease"] = 1] = "Decrease";
})(HoverVerbosityAction$1 || (HoverVerbosityAction$1 = {}));
/**
 * @internal
 */
var CompletionItemKinds;
(function (CompletionItemKinds) {
    const byKind = new Map();
    byKind.set(0 /* CompletionItemKind.Method */, Codicon.symbolMethod);
    byKind.set(1 /* CompletionItemKind.Function */, Codicon.symbolFunction);
    byKind.set(2 /* CompletionItemKind.Constructor */, Codicon.symbolConstructor);
    byKind.set(3 /* CompletionItemKind.Field */, Codicon.symbolField);
    byKind.set(4 /* CompletionItemKind.Variable */, Codicon.symbolVariable);
    byKind.set(5 /* CompletionItemKind.Class */, Codicon.symbolClass);
    byKind.set(6 /* CompletionItemKind.Struct */, Codicon.symbolStruct);
    byKind.set(7 /* CompletionItemKind.Interface */, Codicon.symbolInterface);
    byKind.set(8 /* CompletionItemKind.Module */, Codicon.symbolModule);
    byKind.set(9 /* CompletionItemKind.Property */, Codicon.symbolProperty);
    byKind.set(10 /* CompletionItemKind.Event */, Codicon.symbolEvent);
    byKind.set(11 /* CompletionItemKind.Operator */, Codicon.symbolOperator);
    byKind.set(12 /* CompletionItemKind.Unit */, Codicon.symbolUnit);
    byKind.set(13 /* CompletionItemKind.Value */, Codicon.symbolValue);
    byKind.set(15 /* CompletionItemKind.Enum */, Codicon.symbolEnum);
    byKind.set(14 /* CompletionItemKind.Constant */, Codicon.symbolConstant);
    byKind.set(15 /* CompletionItemKind.Enum */, Codicon.symbolEnum);
    byKind.set(16 /* CompletionItemKind.EnumMember */, Codicon.symbolEnumMember);
    byKind.set(17 /* CompletionItemKind.Keyword */, Codicon.symbolKeyword);
    byKind.set(27 /* CompletionItemKind.Snippet */, Codicon.symbolSnippet);
    byKind.set(18 /* CompletionItemKind.Text */, Codicon.symbolText);
    byKind.set(19 /* CompletionItemKind.Color */, Codicon.symbolColor);
    byKind.set(20 /* CompletionItemKind.File */, Codicon.symbolFile);
    byKind.set(21 /* CompletionItemKind.Reference */, Codicon.symbolReference);
    byKind.set(22 /* CompletionItemKind.Customcolor */, Codicon.symbolCustomColor);
    byKind.set(23 /* CompletionItemKind.Folder */, Codicon.symbolFolder);
    byKind.set(24 /* CompletionItemKind.TypeParameter */, Codicon.symbolTypeParameter);
    byKind.set(25 /* CompletionItemKind.User */, Codicon.account);
    byKind.set(26 /* CompletionItemKind.Issue */, Codicon.issues);
    /**
     * @internal
     */
    function toIcon(kind) {
        let codicon = byKind.get(kind);
        if (!codicon) {
            console.info('No codicon found for CompletionItemKind ' + kind);
            codicon = Codicon.symbolProperty;
        }
        return codicon;
    }
    CompletionItemKinds.toIcon = toIcon;
    const data = new Map();
    data.set('method', 0 /* CompletionItemKind.Method */);
    data.set('function', 1 /* CompletionItemKind.Function */);
    data.set('constructor', 2 /* CompletionItemKind.Constructor */);
    data.set('field', 3 /* CompletionItemKind.Field */);
    data.set('variable', 4 /* CompletionItemKind.Variable */);
    data.set('class', 5 /* CompletionItemKind.Class */);
    data.set('struct', 6 /* CompletionItemKind.Struct */);
    data.set('interface', 7 /* CompletionItemKind.Interface */);
    data.set('module', 8 /* CompletionItemKind.Module */);
    data.set('property', 9 /* CompletionItemKind.Property */);
    data.set('event', 10 /* CompletionItemKind.Event */);
    data.set('operator', 11 /* CompletionItemKind.Operator */);
    data.set('unit', 12 /* CompletionItemKind.Unit */);
    data.set('value', 13 /* CompletionItemKind.Value */);
    data.set('constant', 14 /* CompletionItemKind.Constant */);
    data.set('enum', 15 /* CompletionItemKind.Enum */);
    data.set('enum-member', 16 /* CompletionItemKind.EnumMember */);
    data.set('enumMember', 16 /* CompletionItemKind.EnumMember */);
    data.set('keyword', 17 /* CompletionItemKind.Keyword */);
    data.set('snippet', 27 /* CompletionItemKind.Snippet */);
    data.set('text', 18 /* CompletionItemKind.Text */);
    data.set('color', 19 /* CompletionItemKind.Color */);
    data.set('file', 20 /* CompletionItemKind.File */);
    data.set('reference', 21 /* CompletionItemKind.Reference */);
    data.set('customcolor', 22 /* CompletionItemKind.Customcolor */);
    data.set('folder', 23 /* CompletionItemKind.Folder */);
    data.set('type-parameter', 24 /* CompletionItemKind.TypeParameter */);
    data.set('typeParameter', 24 /* CompletionItemKind.TypeParameter */);
    data.set('account', 25 /* CompletionItemKind.User */);
    data.set('issue', 26 /* CompletionItemKind.Issue */);
    /**
     * @internal
     */
    function fromString(value, strict) {
        let res = data.get(value);
        if (typeof res === 'undefined' && !strict) {
            res = 9 /* CompletionItemKind.Property */;
        }
        return res;
    }
    CompletionItemKinds.fromString = fromString;
})(CompletionItemKinds || (CompletionItemKinds = {}));
/**
 * How an {@link InlineCompletionsProvider inline completion provider} was triggered.
 */
var InlineCompletionTriggerKind$1;
(function (InlineCompletionTriggerKind) {
    /**
     * Completion was triggered automatically while editing.
     * It is sufficient to return a single completion item in this case.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Automatic"] = 0] = "Automatic";
    /**
     * Completion was triggered explicitly by a user gesture.
     * Return multiple completion items to enable cycling through them.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Explicit"] = 1] = "Explicit";
})(InlineCompletionTriggerKind$1 || (InlineCompletionTriggerKind$1 = {}));
/**
 * @internal
 */
var DocumentPasteTriggerKind;
(function (DocumentPasteTriggerKind) {
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["Automatic"] = 0] = "Automatic";
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["PasteAs"] = 1] = "PasteAs";
})(DocumentPasteTriggerKind || (DocumentPasteTriggerKind = {}));
var SignatureHelpTriggerKind$1;
(function (SignatureHelpTriggerKind) {
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["Invoke"] = 1] = "Invoke";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["TriggerCharacter"] = 2] = "TriggerCharacter";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["ContentChange"] = 3] = "ContentChange";
})(SignatureHelpTriggerKind$1 || (SignatureHelpTriggerKind$1 = {}));
/**
 * A document highlight kind.
 */
var DocumentHighlightKind$1;
(function (DocumentHighlightKind) {
    /**
     * A textual occurrence.
     */
    DocumentHighlightKind[DocumentHighlightKind["Text"] = 0] = "Text";
    /**
     * Read-access of a symbol, like reading a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Read"] = 1] = "Read";
    /**
     * Write-access of a symbol, like writing to a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Write"] = 2] = "Write";
})(DocumentHighlightKind$1 || (DocumentHighlightKind$1 = {}));
/**
 * @internal
 */
({
    [17 /* SymbolKind.Array */]: localize('Array', "array"),
    [16 /* SymbolKind.Boolean */]: localize('Boolean', "boolean"),
    [4 /* SymbolKind.Class */]: localize('Class', "class"),
    [13 /* SymbolKind.Constant */]: localize('Constant', "constant"),
    [8 /* SymbolKind.Constructor */]: localize('Constructor', "constructor"),
    [9 /* SymbolKind.Enum */]: localize('Enum', "enumeration"),
    [21 /* SymbolKind.EnumMember */]: localize('EnumMember', "enumeration member"),
    [23 /* SymbolKind.Event */]: localize('Event', "event"),
    [7 /* SymbolKind.Field */]: localize('Field', "field"),
    [0 /* SymbolKind.File */]: localize('File', "file"),
    [11 /* SymbolKind.Function */]: localize('Function', "function"),
    [10 /* SymbolKind.Interface */]: localize('Interface', "interface"),
    [19 /* SymbolKind.Key */]: localize('Key', "key"),
    [5 /* SymbolKind.Method */]: localize('Method', "method"),
    [1 /* SymbolKind.Module */]: localize('Module', "module"),
    [2 /* SymbolKind.Namespace */]: localize('Namespace', "namespace"),
    [20 /* SymbolKind.Null */]: localize('Null', "null"),
    [15 /* SymbolKind.Number */]: localize('Number', "number"),
    [18 /* SymbolKind.Object */]: localize('Object', "object"),
    [24 /* SymbolKind.Operator */]: localize('Operator', "operator"),
    [3 /* SymbolKind.Package */]: localize('Package', "package"),
    [6 /* SymbolKind.Property */]: localize('Property', "property"),
    [14 /* SymbolKind.String */]: localize('String', "string"),
    [22 /* SymbolKind.Struct */]: localize('Struct', "struct"),
    [25 /* SymbolKind.TypeParameter */]: localize('TypeParameter', "type parameter"),
    [12 /* SymbolKind.Variable */]: localize('Variable', "variable"),
});
/**
 * @internal
 */
var SymbolKinds;
(function (SymbolKinds) {
    const byKind = new Map();
    byKind.set(0 /* SymbolKind.File */, Codicon.symbolFile);
    byKind.set(1 /* SymbolKind.Module */, Codicon.symbolModule);
    byKind.set(2 /* SymbolKind.Namespace */, Codicon.symbolNamespace);
    byKind.set(3 /* SymbolKind.Package */, Codicon.symbolPackage);
    byKind.set(4 /* SymbolKind.Class */, Codicon.symbolClass);
    byKind.set(5 /* SymbolKind.Method */, Codicon.symbolMethod);
    byKind.set(6 /* SymbolKind.Property */, Codicon.symbolProperty);
    byKind.set(7 /* SymbolKind.Field */, Codicon.symbolField);
    byKind.set(8 /* SymbolKind.Constructor */, Codicon.symbolConstructor);
    byKind.set(9 /* SymbolKind.Enum */, Codicon.symbolEnum);
    byKind.set(10 /* SymbolKind.Interface */, Codicon.symbolInterface);
    byKind.set(11 /* SymbolKind.Function */, Codicon.symbolFunction);
    byKind.set(12 /* SymbolKind.Variable */, Codicon.symbolVariable);
    byKind.set(13 /* SymbolKind.Constant */, Codicon.symbolConstant);
    byKind.set(14 /* SymbolKind.String */, Codicon.symbolString);
    byKind.set(15 /* SymbolKind.Number */, Codicon.symbolNumber);
    byKind.set(16 /* SymbolKind.Boolean */, Codicon.symbolBoolean);
    byKind.set(17 /* SymbolKind.Array */, Codicon.symbolArray);
    byKind.set(18 /* SymbolKind.Object */, Codicon.symbolObject);
    byKind.set(19 /* SymbolKind.Key */, Codicon.symbolKey);
    byKind.set(20 /* SymbolKind.Null */, Codicon.symbolNull);
    byKind.set(21 /* SymbolKind.EnumMember */, Codicon.symbolEnumMember);
    byKind.set(22 /* SymbolKind.Struct */, Codicon.symbolStruct);
    byKind.set(23 /* SymbolKind.Event */, Codicon.symbolEvent);
    byKind.set(24 /* SymbolKind.Operator */, Codicon.symbolOperator);
    byKind.set(25 /* SymbolKind.TypeParameter */, Codicon.symbolTypeParameter);
    /**
     * @internal
     */
    function toIcon(kind) {
        let icon = byKind.get(kind);
        if (!icon) {
            console.info('No codicon found for SymbolKind ' + kind);
            icon = Codicon.symbolProperty;
        }
        return icon;
    }
    SymbolKinds.toIcon = toIcon;
})(SymbolKinds || (SymbolKinds = {}));
var NewSymbolNameTag$1;
(function (NewSymbolNameTag) {
    NewSymbolNameTag[NewSymbolNameTag["AIGenerated"] = 1] = "AIGenerated";
})(NewSymbolNameTag$1 || (NewSymbolNameTag$1 = {}));
var NewSymbolNameTriggerKind$1;
(function (NewSymbolNameTriggerKind) {
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Invoke"] = 0] = "Invoke";
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Automatic"] = 1] = "Automatic";
})(NewSymbolNameTriggerKind$1 || (NewSymbolNameTriggerKind$1 = {}));
/**
 * @internal
 */
var Command;
(function (Command) {
    /**
     * @internal
     */
    function is(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        return typeof obj.id === 'string' &&
            typeof obj.title === 'string';
    }
    Command.is = is;
})(Command || (Command = {}));
var InlayHintKind$1;
(function (InlayHintKind) {
    InlayHintKind[InlayHintKind["Type"] = 1] = "Type";
    InlayHintKind[InlayHintKind["Parameter"] = 2] = "Parameter";
})(InlayHintKind$1 || (InlayHintKind$1 = {}));
/**
 * @internal
 */
new TokenizationRegistry();
var InlineEditTriggerKind$1;
(function (InlineEditTriggerKind) {
    InlineEditTriggerKind[InlineEditTriggerKind["Invoke"] = 0] = "Invoke";
    InlineEditTriggerKind[InlineEditTriggerKind["Automatic"] = 1] = "Automatic";
})(InlineEditTriggerKind$1 || (InlineEditTriggerKind$1 = {}));

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// THIS IS A GENERATED FILE. DO NOT EDIT DIRECTLY.
var AccessibilitySupport;
(function (AccessibilitySupport) {
    /**
     * This should be the browser case where it is not known if a screen reader is attached or no.
     */
    AccessibilitySupport[AccessibilitySupport["Unknown"] = 0] = "Unknown";
    AccessibilitySupport[AccessibilitySupport["Disabled"] = 1] = "Disabled";
    AccessibilitySupport[AccessibilitySupport["Enabled"] = 2] = "Enabled";
})(AccessibilitySupport || (AccessibilitySupport = {}));
var CodeActionTriggerType;
(function (CodeActionTriggerType) {
    CodeActionTriggerType[CodeActionTriggerType["Invoke"] = 1] = "Invoke";
    CodeActionTriggerType[CodeActionTriggerType["Auto"] = 2] = "Auto";
})(CodeActionTriggerType || (CodeActionTriggerType = {}));
var CompletionItemInsertTextRule;
(function (CompletionItemInsertTextRule) {
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["None"] = 0] = "None";
    /**
     * Adjust whitespace/indentation of multiline insert texts to
     * match the current line indentation.
     */
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["KeepWhitespace"] = 1] = "KeepWhitespace";
    /**
     * `insertText` is a snippet.
     */
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["InsertAsSnippet"] = 4] = "InsertAsSnippet";
})(CompletionItemInsertTextRule || (CompletionItemInsertTextRule = {}));
var CompletionItemKind;
(function (CompletionItemKind) {
    CompletionItemKind[CompletionItemKind["Method"] = 0] = "Method";
    CompletionItemKind[CompletionItemKind["Function"] = 1] = "Function";
    CompletionItemKind[CompletionItemKind["Constructor"] = 2] = "Constructor";
    CompletionItemKind[CompletionItemKind["Field"] = 3] = "Field";
    CompletionItemKind[CompletionItemKind["Variable"] = 4] = "Variable";
    CompletionItemKind[CompletionItemKind["Class"] = 5] = "Class";
    CompletionItemKind[CompletionItemKind["Struct"] = 6] = "Struct";
    CompletionItemKind[CompletionItemKind["Interface"] = 7] = "Interface";
    CompletionItemKind[CompletionItemKind["Module"] = 8] = "Module";
    CompletionItemKind[CompletionItemKind["Property"] = 9] = "Property";
    CompletionItemKind[CompletionItemKind["Event"] = 10] = "Event";
    CompletionItemKind[CompletionItemKind["Operator"] = 11] = "Operator";
    CompletionItemKind[CompletionItemKind["Unit"] = 12] = "Unit";
    CompletionItemKind[CompletionItemKind["Value"] = 13] = "Value";
    CompletionItemKind[CompletionItemKind["Constant"] = 14] = "Constant";
    CompletionItemKind[CompletionItemKind["Enum"] = 15] = "Enum";
    CompletionItemKind[CompletionItemKind["EnumMember"] = 16] = "EnumMember";
    CompletionItemKind[CompletionItemKind["Keyword"] = 17] = "Keyword";
    CompletionItemKind[CompletionItemKind["Text"] = 18] = "Text";
    CompletionItemKind[CompletionItemKind["Color"] = 19] = "Color";
    CompletionItemKind[CompletionItemKind["File"] = 20] = "File";
    CompletionItemKind[CompletionItemKind["Reference"] = 21] = "Reference";
    CompletionItemKind[CompletionItemKind["Customcolor"] = 22] = "Customcolor";
    CompletionItemKind[CompletionItemKind["Folder"] = 23] = "Folder";
    CompletionItemKind[CompletionItemKind["TypeParameter"] = 24] = "TypeParameter";
    CompletionItemKind[CompletionItemKind["User"] = 25] = "User";
    CompletionItemKind[CompletionItemKind["Issue"] = 26] = "Issue";
    CompletionItemKind[CompletionItemKind["Snippet"] = 27] = "Snippet";
})(CompletionItemKind || (CompletionItemKind = {}));
var CompletionItemTag;
(function (CompletionItemTag) {
    CompletionItemTag[CompletionItemTag["Deprecated"] = 1] = "Deprecated";
})(CompletionItemTag || (CompletionItemTag = {}));
/**
 * How a suggest provider was triggered.
 */
var CompletionTriggerKind;
(function (CompletionTriggerKind) {
    CompletionTriggerKind[CompletionTriggerKind["Invoke"] = 0] = "Invoke";
    CompletionTriggerKind[CompletionTriggerKind["TriggerCharacter"] = 1] = "TriggerCharacter";
    CompletionTriggerKind[CompletionTriggerKind["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
})(CompletionTriggerKind || (CompletionTriggerKind = {}));
/**
 * A positioning preference for rendering content widgets.
 */
var ContentWidgetPositionPreference;
(function (ContentWidgetPositionPreference) {
    /**
     * Place the content widget exactly at a position
     */
    ContentWidgetPositionPreference[ContentWidgetPositionPreference["EXACT"] = 0] = "EXACT";
    /**
     * Place the content widget above a position
     */
    ContentWidgetPositionPreference[ContentWidgetPositionPreference["ABOVE"] = 1] = "ABOVE";
    /**
     * Place the content widget below a position
     */
    ContentWidgetPositionPreference[ContentWidgetPositionPreference["BELOW"] = 2] = "BELOW";
})(ContentWidgetPositionPreference || (ContentWidgetPositionPreference = {}));
/**
 * Describes the reason the cursor has changed its position.
 */
var CursorChangeReason;
(function (CursorChangeReason) {
    /**
     * Unknown or not set.
     */
    CursorChangeReason[CursorChangeReason["NotSet"] = 0] = "NotSet";
    /**
     * A `model.setValue()` was called.
     */
    CursorChangeReason[CursorChangeReason["ContentFlush"] = 1] = "ContentFlush";
    /**
     * The `model` has been changed outside of this cursor and the cursor recovers its position from associated markers.
     */
    CursorChangeReason[CursorChangeReason["RecoverFromMarkers"] = 2] = "RecoverFromMarkers";
    /**
     * There was an explicit user gesture.
     */
    CursorChangeReason[CursorChangeReason["Explicit"] = 3] = "Explicit";
    /**
     * There was a Paste.
     */
    CursorChangeReason[CursorChangeReason["Paste"] = 4] = "Paste";
    /**
     * There was an Undo.
     */
    CursorChangeReason[CursorChangeReason["Undo"] = 5] = "Undo";
    /**
     * There was a Redo.
     */
    CursorChangeReason[CursorChangeReason["Redo"] = 6] = "Redo";
})(CursorChangeReason || (CursorChangeReason = {}));
/**
 * The default end of line to use when instantiating models.
 */
var DefaultEndOfLine;
(function (DefaultEndOfLine) {
    /**
     * Use line feed (\n) as the end of line character.
     */
    DefaultEndOfLine[DefaultEndOfLine["LF"] = 1] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    DefaultEndOfLine[DefaultEndOfLine["CRLF"] = 2] = "CRLF";
})(DefaultEndOfLine || (DefaultEndOfLine = {}));
/**
 * A document highlight kind.
 */
var DocumentHighlightKind;
(function (DocumentHighlightKind) {
    /**
     * A textual occurrence.
     */
    DocumentHighlightKind[DocumentHighlightKind["Text"] = 0] = "Text";
    /**
     * Read-access of a symbol, like reading a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Read"] = 1] = "Read";
    /**
     * Write-access of a symbol, like writing to a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Write"] = 2] = "Write";
})(DocumentHighlightKind || (DocumentHighlightKind = {}));
/**
 * Configuration options for auto indentation in the editor
 */
var EditorAutoIndentStrategy;
(function (EditorAutoIndentStrategy) {
    EditorAutoIndentStrategy[EditorAutoIndentStrategy["None"] = 0] = "None";
    EditorAutoIndentStrategy[EditorAutoIndentStrategy["Keep"] = 1] = "Keep";
    EditorAutoIndentStrategy[EditorAutoIndentStrategy["Brackets"] = 2] = "Brackets";
    EditorAutoIndentStrategy[EditorAutoIndentStrategy["Advanced"] = 3] = "Advanced";
    EditorAutoIndentStrategy[EditorAutoIndentStrategy["Full"] = 4] = "Full";
})(EditorAutoIndentStrategy || (EditorAutoIndentStrategy = {}));
var EditorOption;
(function (EditorOption) {
    EditorOption[EditorOption["acceptSuggestionOnCommitCharacter"] = 0] = "acceptSuggestionOnCommitCharacter";
    EditorOption[EditorOption["acceptSuggestionOnEnter"] = 1] = "acceptSuggestionOnEnter";
    EditorOption[EditorOption["accessibilitySupport"] = 2] = "accessibilitySupport";
    EditorOption[EditorOption["accessibilityPageSize"] = 3] = "accessibilityPageSize";
    EditorOption[EditorOption["ariaLabel"] = 4] = "ariaLabel";
    EditorOption[EditorOption["ariaRequired"] = 5] = "ariaRequired";
    EditorOption[EditorOption["autoClosingBrackets"] = 6] = "autoClosingBrackets";
    EditorOption[EditorOption["autoClosingComments"] = 7] = "autoClosingComments";
    EditorOption[EditorOption["screenReaderAnnounceInlineSuggestion"] = 8] = "screenReaderAnnounceInlineSuggestion";
    EditorOption[EditorOption["autoClosingDelete"] = 9] = "autoClosingDelete";
    EditorOption[EditorOption["autoClosingOvertype"] = 10] = "autoClosingOvertype";
    EditorOption[EditorOption["autoClosingQuotes"] = 11] = "autoClosingQuotes";
    EditorOption[EditorOption["autoIndent"] = 12] = "autoIndent";
    EditorOption[EditorOption["automaticLayout"] = 13] = "automaticLayout";
    EditorOption[EditorOption["autoSurround"] = 14] = "autoSurround";
    EditorOption[EditorOption["bracketPairColorization"] = 15] = "bracketPairColorization";
    EditorOption[EditorOption["guides"] = 16] = "guides";
    EditorOption[EditorOption["codeLens"] = 17] = "codeLens";
    EditorOption[EditorOption["codeLensFontFamily"] = 18] = "codeLensFontFamily";
    EditorOption[EditorOption["codeLensFontSize"] = 19] = "codeLensFontSize";
    EditorOption[EditorOption["colorDecorators"] = 20] = "colorDecorators";
    EditorOption[EditorOption["colorDecoratorsLimit"] = 21] = "colorDecoratorsLimit";
    EditorOption[EditorOption["columnSelection"] = 22] = "columnSelection";
    EditorOption[EditorOption["comments"] = 23] = "comments";
    EditorOption[EditorOption["contextmenu"] = 24] = "contextmenu";
    EditorOption[EditorOption["copyWithSyntaxHighlighting"] = 25] = "copyWithSyntaxHighlighting";
    EditorOption[EditorOption["cursorBlinking"] = 26] = "cursorBlinking";
    EditorOption[EditorOption["cursorSmoothCaretAnimation"] = 27] = "cursorSmoothCaretAnimation";
    EditorOption[EditorOption["cursorStyle"] = 28] = "cursorStyle";
    EditorOption[EditorOption["cursorSurroundingLines"] = 29] = "cursorSurroundingLines";
    EditorOption[EditorOption["cursorSurroundingLinesStyle"] = 30] = "cursorSurroundingLinesStyle";
    EditorOption[EditorOption["cursorWidth"] = 31] = "cursorWidth";
    EditorOption[EditorOption["disableLayerHinting"] = 32] = "disableLayerHinting";
    EditorOption[EditorOption["disableMonospaceOptimizations"] = 33] = "disableMonospaceOptimizations";
    EditorOption[EditorOption["domReadOnly"] = 34] = "domReadOnly";
    EditorOption[EditorOption["dragAndDrop"] = 35] = "dragAndDrop";
    EditorOption[EditorOption["dropIntoEditor"] = 36] = "dropIntoEditor";
    EditorOption[EditorOption["emptySelectionClipboard"] = 37] = "emptySelectionClipboard";
    EditorOption[EditorOption["experimentalWhitespaceRendering"] = 38] = "experimentalWhitespaceRendering";
    EditorOption[EditorOption["extraEditorClassName"] = 39] = "extraEditorClassName";
    EditorOption[EditorOption["fastScrollSensitivity"] = 40] = "fastScrollSensitivity";
    EditorOption[EditorOption["find"] = 41] = "find";
    EditorOption[EditorOption["fixedOverflowWidgets"] = 42] = "fixedOverflowWidgets";
    EditorOption[EditorOption["folding"] = 43] = "folding";
    EditorOption[EditorOption["foldingStrategy"] = 44] = "foldingStrategy";
    EditorOption[EditorOption["foldingHighlight"] = 45] = "foldingHighlight";
    EditorOption[EditorOption["foldingImportsByDefault"] = 46] = "foldingImportsByDefault";
    EditorOption[EditorOption["foldingMaximumRegions"] = 47] = "foldingMaximumRegions";
    EditorOption[EditorOption["unfoldOnClickAfterEndOfLine"] = 48] = "unfoldOnClickAfterEndOfLine";
    EditorOption[EditorOption["fontFamily"] = 49] = "fontFamily";
    EditorOption[EditorOption["fontInfo"] = 50] = "fontInfo";
    EditorOption[EditorOption["fontLigatures"] = 51] = "fontLigatures";
    EditorOption[EditorOption["fontSize"] = 52] = "fontSize";
    EditorOption[EditorOption["fontWeight"] = 53] = "fontWeight";
    EditorOption[EditorOption["fontVariations"] = 54] = "fontVariations";
    EditorOption[EditorOption["formatOnPaste"] = 55] = "formatOnPaste";
    EditorOption[EditorOption["formatOnType"] = 56] = "formatOnType";
    EditorOption[EditorOption["glyphMargin"] = 57] = "glyphMargin";
    EditorOption[EditorOption["gotoLocation"] = 58] = "gotoLocation";
    EditorOption[EditorOption["hideCursorInOverviewRuler"] = 59] = "hideCursorInOverviewRuler";
    EditorOption[EditorOption["hover"] = 60] = "hover";
    EditorOption[EditorOption["inDiffEditor"] = 61] = "inDiffEditor";
    EditorOption[EditorOption["inlineSuggest"] = 62] = "inlineSuggest";
    EditorOption[EditorOption["inlineEdit"] = 63] = "inlineEdit";
    EditorOption[EditorOption["letterSpacing"] = 64] = "letterSpacing";
    EditorOption[EditorOption["lightbulb"] = 65] = "lightbulb";
    EditorOption[EditorOption["lineDecorationsWidth"] = 66] = "lineDecorationsWidth";
    EditorOption[EditorOption["lineHeight"] = 67] = "lineHeight";
    EditorOption[EditorOption["lineNumbers"] = 68] = "lineNumbers";
    EditorOption[EditorOption["lineNumbersMinChars"] = 69] = "lineNumbersMinChars";
    EditorOption[EditorOption["linkedEditing"] = 70] = "linkedEditing";
    EditorOption[EditorOption["links"] = 71] = "links";
    EditorOption[EditorOption["matchBrackets"] = 72] = "matchBrackets";
    EditorOption[EditorOption["minimap"] = 73] = "minimap";
    EditorOption[EditorOption["mouseStyle"] = 74] = "mouseStyle";
    EditorOption[EditorOption["mouseWheelScrollSensitivity"] = 75] = "mouseWheelScrollSensitivity";
    EditorOption[EditorOption["mouseWheelZoom"] = 76] = "mouseWheelZoom";
    EditorOption[EditorOption["multiCursorMergeOverlapping"] = 77] = "multiCursorMergeOverlapping";
    EditorOption[EditorOption["multiCursorModifier"] = 78] = "multiCursorModifier";
    EditorOption[EditorOption["multiCursorPaste"] = 79] = "multiCursorPaste";
    EditorOption[EditorOption["multiCursorLimit"] = 80] = "multiCursorLimit";
    EditorOption[EditorOption["occurrencesHighlight"] = 81] = "occurrencesHighlight";
    EditorOption[EditorOption["overviewRulerBorder"] = 82] = "overviewRulerBorder";
    EditorOption[EditorOption["overviewRulerLanes"] = 83] = "overviewRulerLanes";
    EditorOption[EditorOption["padding"] = 84] = "padding";
    EditorOption[EditorOption["pasteAs"] = 85] = "pasteAs";
    EditorOption[EditorOption["parameterHints"] = 86] = "parameterHints";
    EditorOption[EditorOption["peekWidgetDefaultFocus"] = 87] = "peekWidgetDefaultFocus";
    EditorOption[EditorOption["definitionLinkOpensInPeek"] = 88] = "definitionLinkOpensInPeek";
    EditorOption[EditorOption["quickSuggestions"] = 89] = "quickSuggestions";
    EditorOption[EditorOption["quickSuggestionsDelay"] = 90] = "quickSuggestionsDelay";
    EditorOption[EditorOption["readOnly"] = 91] = "readOnly";
    EditorOption[EditorOption["readOnlyMessage"] = 92] = "readOnlyMessage";
    EditorOption[EditorOption["renameOnType"] = 93] = "renameOnType";
    EditorOption[EditorOption["renderControlCharacters"] = 94] = "renderControlCharacters";
    EditorOption[EditorOption["renderFinalNewline"] = 95] = "renderFinalNewline";
    EditorOption[EditorOption["renderLineHighlight"] = 96] = "renderLineHighlight";
    EditorOption[EditorOption["renderLineHighlightOnlyWhenFocus"] = 97] = "renderLineHighlightOnlyWhenFocus";
    EditorOption[EditorOption["renderValidationDecorations"] = 98] = "renderValidationDecorations";
    EditorOption[EditorOption["renderWhitespace"] = 99] = "renderWhitespace";
    EditorOption[EditorOption["revealHorizontalRightPadding"] = 100] = "revealHorizontalRightPadding";
    EditorOption[EditorOption["roundedSelection"] = 101] = "roundedSelection";
    EditorOption[EditorOption["rulers"] = 102] = "rulers";
    EditorOption[EditorOption["scrollbar"] = 103] = "scrollbar";
    EditorOption[EditorOption["scrollBeyondLastColumn"] = 104] = "scrollBeyondLastColumn";
    EditorOption[EditorOption["scrollBeyondLastLine"] = 105] = "scrollBeyondLastLine";
    EditorOption[EditorOption["scrollPredominantAxis"] = 106] = "scrollPredominantAxis";
    EditorOption[EditorOption["selectionClipboard"] = 107] = "selectionClipboard";
    EditorOption[EditorOption["selectionHighlight"] = 108] = "selectionHighlight";
    EditorOption[EditorOption["selectOnLineNumbers"] = 109] = "selectOnLineNumbers";
    EditorOption[EditorOption["showFoldingControls"] = 110] = "showFoldingControls";
    EditorOption[EditorOption["showUnused"] = 111] = "showUnused";
    EditorOption[EditorOption["snippetSuggestions"] = 112] = "snippetSuggestions";
    EditorOption[EditorOption["smartSelect"] = 113] = "smartSelect";
    EditorOption[EditorOption["smoothScrolling"] = 114] = "smoothScrolling";
    EditorOption[EditorOption["stickyScroll"] = 115] = "stickyScroll";
    EditorOption[EditorOption["stickyTabStops"] = 116] = "stickyTabStops";
    EditorOption[EditorOption["stopRenderingLineAfter"] = 117] = "stopRenderingLineAfter";
    EditorOption[EditorOption["suggest"] = 118] = "suggest";
    EditorOption[EditorOption["suggestFontSize"] = 119] = "suggestFontSize";
    EditorOption[EditorOption["suggestLineHeight"] = 120] = "suggestLineHeight";
    EditorOption[EditorOption["suggestOnTriggerCharacters"] = 121] = "suggestOnTriggerCharacters";
    EditorOption[EditorOption["suggestSelection"] = 122] = "suggestSelection";
    EditorOption[EditorOption["tabCompletion"] = 123] = "tabCompletion";
    EditorOption[EditorOption["tabIndex"] = 124] = "tabIndex";
    EditorOption[EditorOption["unicodeHighlighting"] = 125] = "unicodeHighlighting";
    EditorOption[EditorOption["unusualLineTerminators"] = 126] = "unusualLineTerminators";
    EditorOption[EditorOption["useShadowDOM"] = 127] = "useShadowDOM";
    EditorOption[EditorOption["useTabStops"] = 128] = "useTabStops";
    EditorOption[EditorOption["wordBreak"] = 129] = "wordBreak";
    EditorOption[EditorOption["wordSegmenterLocales"] = 130] = "wordSegmenterLocales";
    EditorOption[EditorOption["wordSeparators"] = 131] = "wordSeparators";
    EditorOption[EditorOption["wordWrap"] = 132] = "wordWrap";
    EditorOption[EditorOption["wordWrapBreakAfterCharacters"] = 133] = "wordWrapBreakAfterCharacters";
    EditorOption[EditorOption["wordWrapBreakBeforeCharacters"] = 134] = "wordWrapBreakBeforeCharacters";
    EditorOption[EditorOption["wordWrapColumn"] = 135] = "wordWrapColumn";
    EditorOption[EditorOption["wordWrapOverride1"] = 136] = "wordWrapOverride1";
    EditorOption[EditorOption["wordWrapOverride2"] = 137] = "wordWrapOverride2";
    EditorOption[EditorOption["wrappingIndent"] = 138] = "wrappingIndent";
    EditorOption[EditorOption["wrappingStrategy"] = 139] = "wrappingStrategy";
    EditorOption[EditorOption["showDeprecated"] = 140] = "showDeprecated";
    EditorOption[EditorOption["inlayHints"] = 141] = "inlayHints";
    EditorOption[EditorOption["editorClassName"] = 142] = "editorClassName";
    EditorOption[EditorOption["pixelRatio"] = 143] = "pixelRatio";
    EditorOption[EditorOption["tabFocusMode"] = 144] = "tabFocusMode";
    EditorOption[EditorOption["layoutInfo"] = 145] = "layoutInfo";
    EditorOption[EditorOption["wrappingInfo"] = 146] = "wrappingInfo";
    EditorOption[EditorOption["defaultColorDecorators"] = 147] = "defaultColorDecorators";
    EditorOption[EditorOption["colorDecoratorsActivatedOn"] = 148] = "colorDecoratorsActivatedOn";
    EditorOption[EditorOption["inlineCompletionsAccessibilityVerbose"] = 149] = "inlineCompletionsAccessibilityVerbose";
})(EditorOption || (EditorOption = {}));
/**
 * End of line character preference.
 */
var EndOfLinePreference;
(function (EndOfLinePreference) {
    /**
     * Use the end of line character identified in the text buffer.
     */
    EndOfLinePreference[EndOfLinePreference["TextDefined"] = 0] = "TextDefined";
    /**
     * Use line feed (\n) as the end of line character.
     */
    EndOfLinePreference[EndOfLinePreference["LF"] = 1] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    EndOfLinePreference[EndOfLinePreference["CRLF"] = 2] = "CRLF";
})(EndOfLinePreference || (EndOfLinePreference = {}));
/**
 * End of line character preference.
 */
var EndOfLineSequence;
(function (EndOfLineSequence) {
    /**
     * Use line feed (\n) as the end of line character.
     */
    EndOfLineSequence[EndOfLineSequence["LF"] = 0] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    EndOfLineSequence[EndOfLineSequence["CRLF"] = 1] = "CRLF";
})(EndOfLineSequence || (EndOfLineSequence = {}));
/**
 * Vertical Lane in the glyph margin of the editor.
 */
var GlyphMarginLane$1;
(function (GlyphMarginLane) {
    GlyphMarginLane[GlyphMarginLane["Left"] = 1] = "Left";
    GlyphMarginLane[GlyphMarginLane["Center"] = 2] = "Center";
    GlyphMarginLane[GlyphMarginLane["Right"] = 3] = "Right";
})(GlyphMarginLane$1 || (GlyphMarginLane$1 = {}));
var HoverVerbosityAction;
(function (HoverVerbosityAction) {
    /**
     * Increase the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Increase"] = 0] = "Increase";
    /**
     * Decrease the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Decrease"] = 1] = "Decrease";
})(HoverVerbosityAction || (HoverVerbosityAction = {}));
/**
 * Describes what to do with the indentation when pressing Enter.
 */
var IndentAction;
(function (IndentAction) {
    /**
     * Insert new line and copy the previous line's indentation.
     */
    IndentAction[IndentAction["None"] = 0] = "None";
    /**
     * Insert new line and indent once (relative to the previous line's indentation).
     */
    IndentAction[IndentAction["Indent"] = 1] = "Indent";
    /**
     * Insert two new lines:
     *  - the first one indented which will hold the cursor
     *  - the second one at the same indentation level
     */
    IndentAction[IndentAction["IndentOutdent"] = 2] = "IndentOutdent";
    /**
     * Insert new line and outdent once (relative to the previous line's indentation).
     */
    IndentAction[IndentAction["Outdent"] = 3] = "Outdent";
})(IndentAction || (IndentAction = {}));
var InjectedTextCursorStops$1;
(function (InjectedTextCursorStops) {
    InjectedTextCursorStops[InjectedTextCursorStops["Both"] = 0] = "Both";
    InjectedTextCursorStops[InjectedTextCursorStops["Right"] = 1] = "Right";
    InjectedTextCursorStops[InjectedTextCursorStops["Left"] = 2] = "Left";
    InjectedTextCursorStops[InjectedTextCursorStops["None"] = 3] = "None";
})(InjectedTextCursorStops$1 || (InjectedTextCursorStops$1 = {}));
var InlayHintKind;
(function (InlayHintKind) {
    InlayHintKind[InlayHintKind["Type"] = 1] = "Type";
    InlayHintKind[InlayHintKind["Parameter"] = 2] = "Parameter";
})(InlayHintKind || (InlayHintKind = {}));
/**
 * How an {@link InlineCompletionsProvider inline completion provider} was triggered.
 */
var InlineCompletionTriggerKind;
(function (InlineCompletionTriggerKind) {
    /**
     * Completion was triggered automatically while editing.
     * It is sufficient to return a single completion item in this case.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Automatic"] = 0] = "Automatic";
    /**
     * Completion was triggered explicitly by a user gesture.
     * Return multiple completion items to enable cycling through them.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Explicit"] = 1] = "Explicit";
})(InlineCompletionTriggerKind || (InlineCompletionTriggerKind = {}));
var InlineEditTriggerKind;
(function (InlineEditTriggerKind) {
    InlineEditTriggerKind[InlineEditTriggerKind["Invoke"] = 0] = "Invoke";
    InlineEditTriggerKind[InlineEditTriggerKind["Automatic"] = 1] = "Automatic";
})(InlineEditTriggerKind || (InlineEditTriggerKind = {}));
/**
 * Virtual Key Codes, the value does not hold any inherent meaning.
 * Inspired somewhat from https://msdn.microsoft.com/en-us/library/windows/desktop/dd375731(v=vs.85).aspx
 * But these are "more general", as they should work across browsers & OS`s.
 */
var KeyCode;
(function (KeyCode) {
    KeyCode[KeyCode["DependsOnKbLayout"] = -1] = "DependsOnKbLayout";
    /**
     * Placed first to cover the 0 value of the enum.
     */
    KeyCode[KeyCode["Unknown"] = 0] = "Unknown";
    KeyCode[KeyCode["Backspace"] = 1] = "Backspace";
    KeyCode[KeyCode["Tab"] = 2] = "Tab";
    KeyCode[KeyCode["Enter"] = 3] = "Enter";
    KeyCode[KeyCode["Shift"] = 4] = "Shift";
    KeyCode[KeyCode["Ctrl"] = 5] = "Ctrl";
    KeyCode[KeyCode["Alt"] = 6] = "Alt";
    KeyCode[KeyCode["PauseBreak"] = 7] = "PauseBreak";
    KeyCode[KeyCode["CapsLock"] = 8] = "CapsLock";
    KeyCode[KeyCode["Escape"] = 9] = "Escape";
    KeyCode[KeyCode["Space"] = 10] = "Space";
    KeyCode[KeyCode["PageUp"] = 11] = "PageUp";
    KeyCode[KeyCode["PageDown"] = 12] = "PageDown";
    KeyCode[KeyCode["End"] = 13] = "End";
    KeyCode[KeyCode["Home"] = 14] = "Home";
    KeyCode[KeyCode["LeftArrow"] = 15] = "LeftArrow";
    KeyCode[KeyCode["UpArrow"] = 16] = "UpArrow";
    KeyCode[KeyCode["RightArrow"] = 17] = "RightArrow";
    KeyCode[KeyCode["DownArrow"] = 18] = "DownArrow";
    KeyCode[KeyCode["Insert"] = 19] = "Insert";
    KeyCode[KeyCode["Delete"] = 20] = "Delete";
    KeyCode[KeyCode["Digit0"] = 21] = "Digit0";
    KeyCode[KeyCode["Digit1"] = 22] = "Digit1";
    KeyCode[KeyCode["Digit2"] = 23] = "Digit2";
    KeyCode[KeyCode["Digit3"] = 24] = "Digit3";
    KeyCode[KeyCode["Digit4"] = 25] = "Digit4";
    KeyCode[KeyCode["Digit5"] = 26] = "Digit5";
    KeyCode[KeyCode["Digit6"] = 27] = "Digit6";
    KeyCode[KeyCode["Digit7"] = 28] = "Digit7";
    KeyCode[KeyCode["Digit8"] = 29] = "Digit8";
    KeyCode[KeyCode["Digit9"] = 30] = "Digit9";
    KeyCode[KeyCode["KeyA"] = 31] = "KeyA";
    KeyCode[KeyCode["KeyB"] = 32] = "KeyB";
    KeyCode[KeyCode["KeyC"] = 33] = "KeyC";
    KeyCode[KeyCode["KeyD"] = 34] = "KeyD";
    KeyCode[KeyCode["KeyE"] = 35] = "KeyE";
    KeyCode[KeyCode["KeyF"] = 36] = "KeyF";
    KeyCode[KeyCode["KeyG"] = 37] = "KeyG";
    KeyCode[KeyCode["KeyH"] = 38] = "KeyH";
    KeyCode[KeyCode["KeyI"] = 39] = "KeyI";
    KeyCode[KeyCode["KeyJ"] = 40] = "KeyJ";
    KeyCode[KeyCode["KeyK"] = 41] = "KeyK";
    KeyCode[KeyCode["KeyL"] = 42] = "KeyL";
    KeyCode[KeyCode["KeyM"] = 43] = "KeyM";
    KeyCode[KeyCode["KeyN"] = 44] = "KeyN";
    KeyCode[KeyCode["KeyO"] = 45] = "KeyO";
    KeyCode[KeyCode["KeyP"] = 46] = "KeyP";
    KeyCode[KeyCode["KeyQ"] = 47] = "KeyQ";
    KeyCode[KeyCode["KeyR"] = 48] = "KeyR";
    KeyCode[KeyCode["KeyS"] = 49] = "KeyS";
    KeyCode[KeyCode["KeyT"] = 50] = "KeyT";
    KeyCode[KeyCode["KeyU"] = 51] = "KeyU";
    KeyCode[KeyCode["KeyV"] = 52] = "KeyV";
    KeyCode[KeyCode["KeyW"] = 53] = "KeyW";
    KeyCode[KeyCode["KeyX"] = 54] = "KeyX";
    KeyCode[KeyCode["KeyY"] = 55] = "KeyY";
    KeyCode[KeyCode["KeyZ"] = 56] = "KeyZ";
    KeyCode[KeyCode["Meta"] = 57] = "Meta";
    KeyCode[KeyCode["ContextMenu"] = 58] = "ContextMenu";
    KeyCode[KeyCode["F1"] = 59] = "F1";
    KeyCode[KeyCode["F2"] = 60] = "F2";
    KeyCode[KeyCode["F3"] = 61] = "F3";
    KeyCode[KeyCode["F4"] = 62] = "F4";
    KeyCode[KeyCode["F5"] = 63] = "F5";
    KeyCode[KeyCode["F6"] = 64] = "F6";
    KeyCode[KeyCode["F7"] = 65] = "F7";
    KeyCode[KeyCode["F8"] = 66] = "F8";
    KeyCode[KeyCode["F9"] = 67] = "F9";
    KeyCode[KeyCode["F10"] = 68] = "F10";
    KeyCode[KeyCode["F11"] = 69] = "F11";
    KeyCode[KeyCode["F12"] = 70] = "F12";
    KeyCode[KeyCode["F13"] = 71] = "F13";
    KeyCode[KeyCode["F14"] = 72] = "F14";
    KeyCode[KeyCode["F15"] = 73] = "F15";
    KeyCode[KeyCode["F16"] = 74] = "F16";
    KeyCode[KeyCode["F17"] = 75] = "F17";
    KeyCode[KeyCode["F18"] = 76] = "F18";
    KeyCode[KeyCode["F19"] = 77] = "F19";
    KeyCode[KeyCode["F20"] = 78] = "F20";
    KeyCode[KeyCode["F21"] = 79] = "F21";
    KeyCode[KeyCode["F22"] = 80] = "F22";
    KeyCode[KeyCode["F23"] = 81] = "F23";
    KeyCode[KeyCode["F24"] = 82] = "F24";
    KeyCode[KeyCode["NumLock"] = 83] = "NumLock";
    KeyCode[KeyCode["ScrollLock"] = 84] = "ScrollLock";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ';:' key
     */
    KeyCode[KeyCode["Semicolon"] = 85] = "Semicolon";
    /**
     * For any country/region, the '+' key
     * For the US standard keyboard, the '=+' key
     */
    KeyCode[KeyCode["Equal"] = 86] = "Equal";
    /**
     * For any country/region, the ',' key
     * For the US standard keyboard, the ',<' key
     */
    KeyCode[KeyCode["Comma"] = 87] = "Comma";
    /**
     * For any country/region, the '-' key
     * For the US standard keyboard, the '-_' key
     */
    KeyCode[KeyCode["Minus"] = 88] = "Minus";
    /**
     * For any country/region, the '.' key
     * For the US standard keyboard, the '.>' key
     */
    KeyCode[KeyCode["Period"] = 89] = "Period";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '/?' key
     */
    KeyCode[KeyCode["Slash"] = 90] = "Slash";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '`~' key
     */
    KeyCode[KeyCode["Backquote"] = 91] = "Backquote";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '[{' key
     */
    KeyCode[KeyCode["BracketLeft"] = 92] = "BracketLeft";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '\|' key
     */
    KeyCode[KeyCode["Backslash"] = 93] = "Backslash";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ']}' key
     */
    KeyCode[KeyCode["BracketRight"] = 94] = "BracketRight";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ''"' key
     */
    KeyCode[KeyCode["Quote"] = 95] = "Quote";
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     */
    KeyCode[KeyCode["OEM_8"] = 96] = "OEM_8";
    /**
     * Either the angle bracket key or the backslash key on the RT 102-key keyboard.
     */
    KeyCode[KeyCode["IntlBackslash"] = 97] = "IntlBackslash";
    KeyCode[KeyCode["Numpad0"] = 98] = "Numpad0";
    KeyCode[KeyCode["Numpad1"] = 99] = "Numpad1";
    KeyCode[KeyCode["Numpad2"] = 100] = "Numpad2";
    KeyCode[KeyCode["Numpad3"] = 101] = "Numpad3";
    KeyCode[KeyCode["Numpad4"] = 102] = "Numpad4";
    KeyCode[KeyCode["Numpad5"] = 103] = "Numpad5";
    KeyCode[KeyCode["Numpad6"] = 104] = "Numpad6";
    KeyCode[KeyCode["Numpad7"] = 105] = "Numpad7";
    KeyCode[KeyCode["Numpad8"] = 106] = "Numpad8";
    KeyCode[KeyCode["Numpad9"] = 107] = "Numpad9";
    KeyCode[KeyCode["NumpadMultiply"] = 108] = "NumpadMultiply";
    KeyCode[KeyCode["NumpadAdd"] = 109] = "NumpadAdd";
    KeyCode[KeyCode["NUMPAD_SEPARATOR"] = 110] = "NUMPAD_SEPARATOR";
    KeyCode[KeyCode["NumpadSubtract"] = 111] = "NumpadSubtract";
    KeyCode[KeyCode["NumpadDecimal"] = 112] = "NumpadDecimal";
    KeyCode[KeyCode["NumpadDivide"] = 113] = "NumpadDivide";
    /**
     * Cover all key codes when IME is processing input.
     */
    KeyCode[KeyCode["KEY_IN_COMPOSITION"] = 114] = "KEY_IN_COMPOSITION";
    KeyCode[KeyCode["ABNT_C1"] = 115] = "ABNT_C1";
    KeyCode[KeyCode["ABNT_C2"] = 116] = "ABNT_C2";
    KeyCode[KeyCode["AudioVolumeMute"] = 117] = "AudioVolumeMute";
    KeyCode[KeyCode["AudioVolumeUp"] = 118] = "AudioVolumeUp";
    KeyCode[KeyCode["AudioVolumeDown"] = 119] = "AudioVolumeDown";
    KeyCode[KeyCode["BrowserSearch"] = 120] = "BrowserSearch";
    KeyCode[KeyCode["BrowserHome"] = 121] = "BrowserHome";
    KeyCode[KeyCode["BrowserBack"] = 122] = "BrowserBack";
    KeyCode[KeyCode["BrowserForward"] = 123] = "BrowserForward";
    KeyCode[KeyCode["MediaTrackNext"] = 124] = "MediaTrackNext";
    KeyCode[KeyCode["MediaTrackPrevious"] = 125] = "MediaTrackPrevious";
    KeyCode[KeyCode["MediaStop"] = 126] = "MediaStop";
    KeyCode[KeyCode["MediaPlayPause"] = 127] = "MediaPlayPause";
    KeyCode[KeyCode["LaunchMediaPlayer"] = 128] = "LaunchMediaPlayer";
    KeyCode[KeyCode["LaunchMail"] = 129] = "LaunchMail";
    KeyCode[KeyCode["LaunchApp2"] = 130] = "LaunchApp2";
    /**
     * VK_CLEAR, 0x0C, CLEAR key
     */
    KeyCode[KeyCode["Clear"] = 131] = "Clear";
    /**
     * Placed last to cover the length of the enum.
     * Please do not depend on this value!
     */
    KeyCode[KeyCode["MAX_VALUE"] = 132] = "MAX_VALUE";
})(KeyCode || (KeyCode = {}));
var MarkerSeverity;
(function (MarkerSeverity) {
    MarkerSeverity[MarkerSeverity["Hint"] = 1] = "Hint";
    MarkerSeverity[MarkerSeverity["Info"] = 2] = "Info";
    MarkerSeverity[MarkerSeverity["Warning"] = 4] = "Warning";
    MarkerSeverity[MarkerSeverity["Error"] = 8] = "Error";
})(MarkerSeverity || (MarkerSeverity = {}));
var MarkerTag;
(function (MarkerTag) {
    MarkerTag[MarkerTag["Unnecessary"] = 1] = "Unnecessary";
    MarkerTag[MarkerTag["Deprecated"] = 2] = "Deprecated";
})(MarkerTag || (MarkerTag = {}));
/**
 * Position in the minimap to render the decoration.
 */
var MinimapPosition;
(function (MinimapPosition) {
    MinimapPosition[MinimapPosition["Inline"] = 1] = "Inline";
    MinimapPosition[MinimapPosition["Gutter"] = 2] = "Gutter";
})(MinimapPosition || (MinimapPosition = {}));
/**
 * Section header style.
 */
var MinimapSectionHeaderStyle;
(function (MinimapSectionHeaderStyle) {
    MinimapSectionHeaderStyle[MinimapSectionHeaderStyle["Normal"] = 1] = "Normal";
    MinimapSectionHeaderStyle[MinimapSectionHeaderStyle["Underlined"] = 2] = "Underlined";
})(MinimapSectionHeaderStyle || (MinimapSectionHeaderStyle = {}));
/**
 * Type of hit element with the mouse in the editor.
 */
var MouseTargetType;
(function (MouseTargetType) {
    /**
     * Mouse is on top of an unknown element.
     */
    MouseTargetType[MouseTargetType["UNKNOWN"] = 0] = "UNKNOWN";
    /**
     * Mouse is on top of the textarea used for input.
     */
    MouseTargetType[MouseTargetType["TEXTAREA"] = 1] = "TEXTAREA";
    /**
     * Mouse is on top of the glyph margin
     */
    MouseTargetType[MouseTargetType["GUTTER_GLYPH_MARGIN"] = 2] = "GUTTER_GLYPH_MARGIN";
    /**
     * Mouse is on top of the line numbers
     */
    MouseTargetType[MouseTargetType["GUTTER_LINE_NUMBERS"] = 3] = "GUTTER_LINE_NUMBERS";
    /**
     * Mouse is on top of the line decorations
     */
    MouseTargetType[MouseTargetType["GUTTER_LINE_DECORATIONS"] = 4] = "GUTTER_LINE_DECORATIONS";
    /**
     * Mouse is on top of the whitespace left in the gutter by a view zone.
     */
    MouseTargetType[MouseTargetType["GUTTER_VIEW_ZONE"] = 5] = "GUTTER_VIEW_ZONE";
    /**
     * Mouse is on top of text in the content.
     */
    MouseTargetType[MouseTargetType["CONTENT_TEXT"] = 6] = "CONTENT_TEXT";
    /**
     * Mouse is on top of empty space in the content (e.g. after line text or below last line)
     */
    MouseTargetType[MouseTargetType["CONTENT_EMPTY"] = 7] = "CONTENT_EMPTY";
    /**
     * Mouse is on top of a view zone in the content.
     */
    MouseTargetType[MouseTargetType["CONTENT_VIEW_ZONE"] = 8] = "CONTENT_VIEW_ZONE";
    /**
     * Mouse is on top of a content widget.
     */
    MouseTargetType[MouseTargetType["CONTENT_WIDGET"] = 9] = "CONTENT_WIDGET";
    /**
     * Mouse is on top of the decorations overview ruler.
     */
    MouseTargetType[MouseTargetType["OVERVIEW_RULER"] = 10] = "OVERVIEW_RULER";
    /**
     * Mouse is on top of a scrollbar.
     */
    MouseTargetType[MouseTargetType["SCROLLBAR"] = 11] = "SCROLLBAR";
    /**
     * Mouse is on top of an overlay widget.
     */
    MouseTargetType[MouseTargetType["OVERLAY_WIDGET"] = 12] = "OVERLAY_WIDGET";
    /**
     * Mouse is outside of the editor.
     */
    MouseTargetType[MouseTargetType["OUTSIDE_EDITOR"] = 13] = "OUTSIDE_EDITOR";
})(MouseTargetType || (MouseTargetType = {}));
var NewSymbolNameTag;
(function (NewSymbolNameTag) {
    NewSymbolNameTag[NewSymbolNameTag["AIGenerated"] = 1] = "AIGenerated";
})(NewSymbolNameTag || (NewSymbolNameTag = {}));
var NewSymbolNameTriggerKind;
(function (NewSymbolNameTriggerKind) {
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Invoke"] = 0] = "Invoke";
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Automatic"] = 1] = "Automatic";
})(NewSymbolNameTriggerKind || (NewSymbolNameTriggerKind = {}));
/**
 * A positioning preference for rendering overlay widgets.
 */
var OverlayWidgetPositionPreference;
(function (OverlayWidgetPositionPreference) {
    /**
     * Position the overlay widget in the top right corner
     */
    OverlayWidgetPositionPreference[OverlayWidgetPositionPreference["TOP_RIGHT_CORNER"] = 0] = "TOP_RIGHT_CORNER";
    /**
     * Position the overlay widget in the bottom right corner
     */
    OverlayWidgetPositionPreference[OverlayWidgetPositionPreference["BOTTOM_RIGHT_CORNER"] = 1] = "BOTTOM_RIGHT_CORNER";
    /**
     * Position the overlay widget in the top center
     */
    OverlayWidgetPositionPreference[OverlayWidgetPositionPreference["TOP_CENTER"] = 2] = "TOP_CENTER";
})(OverlayWidgetPositionPreference || (OverlayWidgetPositionPreference = {}));
/**
 * Vertical Lane in the overview ruler of the editor.
 */
var OverviewRulerLane$1;
(function (OverviewRulerLane) {
    OverviewRulerLane[OverviewRulerLane["Left"] = 1] = "Left";
    OverviewRulerLane[OverviewRulerLane["Center"] = 2] = "Center";
    OverviewRulerLane[OverviewRulerLane["Right"] = 4] = "Right";
    OverviewRulerLane[OverviewRulerLane["Full"] = 7] = "Full";
})(OverviewRulerLane$1 || (OverviewRulerLane$1 = {}));
/**
 * How a partial acceptance was triggered.
 */
var PartialAcceptTriggerKind;
(function (PartialAcceptTriggerKind) {
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Word"] = 0] = "Word";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Line"] = 1] = "Line";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Suggest"] = 2] = "Suggest";
})(PartialAcceptTriggerKind || (PartialAcceptTriggerKind = {}));
var PositionAffinity;
(function (PositionAffinity) {
    /**
     * Prefers the left most position.
    */
    PositionAffinity[PositionAffinity["Left"] = 0] = "Left";
    /**
     * Prefers the right most position.
    */
    PositionAffinity[PositionAffinity["Right"] = 1] = "Right";
    /**
     * No preference.
    */
    PositionAffinity[PositionAffinity["None"] = 2] = "None";
    /**
     * If the given position is on injected text, prefers the position left of it.
    */
    PositionAffinity[PositionAffinity["LeftOfInjectedText"] = 3] = "LeftOfInjectedText";
    /**
     * If the given position is on injected text, prefers the position right of it.
    */
    PositionAffinity[PositionAffinity["RightOfInjectedText"] = 4] = "RightOfInjectedText";
})(PositionAffinity || (PositionAffinity = {}));
var RenderLineNumbersType;
(function (RenderLineNumbersType) {
    RenderLineNumbersType[RenderLineNumbersType["Off"] = 0] = "Off";
    RenderLineNumbersType[RenderLineNumbersType["On"] = 1] = "On";
    RenderLineNumbersType[RenderLineNumbersType["Relative"] = 2] = "Relative";
    RenderLineNumbersType[RenderLineNumbersType["Interval"] = 3] = "Interval";
    RenderLineNumbersType[RenderLineNumbersType["Custom"] = 4] = "Custom";
})(RenderLineNumbersType || (RenderLineNumbersType = {}));
var RenderMinimap;
(function (RenderMinimap) {
    RenderMinimap[RenderMinimap["None"] = 0] = "None";
    RenderMinimap[RenderMinimap["Text"] = 1] = "Text";
    RenderMinimap[RenderMinimap["Blocks"] = 2] = "Blocks";
})(RenderMinimap || (RenderMinimap = {}));
var ScrollType;
(function (ScrollType) {
    ScrollType[ScrollType["Smooth"] = 0] = "Smooth";
    ScrollType[ScrollType["Immediate"] = 1] = "Immediate";
})(ScrollType || (ScrollType = {}));
var ScrollbarVisibility;
(function (ScrollbarVisibility) {
    ScrollbarVisibility[ScrollbarVisibility["Auto"] = 1] = "Auto";
    ScrollbarVisibility[ScrollbarVisibility["Hidden"] = 2] = "Hidden";
    ScrollbarVisibility[ScrollbarVisibility["Visible"] = 3] = "Visible";
})(ScrollbarVisibility || (ScrollbarVisibility = {}));
/**
 * The direction of a selection.
 */
var SelectionDirection;
(function (SelectionDirection) {
    /**
     * The selection starts above where it ends.
     */
    SelectionDirection[SelectionDirection["LTR"] = 0] = "LTR";
    /**
     * The selection starts below where it ends.
     */
    SelectionDirection[SelectionDirection["RTL"] = 1] = "RTL";
})(SelectionDirection || (SelectionDirection = {}));
var ShowLightbulbIconMode;
(function (ShowLightbulbIconMode) {
    ShowLightbulbIconMode["Off"] = "off";
    ShowLightbulbIconMode["OnCode"] = "onCode";
    ShowLightbulbIconMode["On"] = "on";
})(ShowLightbulbIconMode || (ShowLightbulbIconMode = {}));
var SignatureHelpTriggerKind;
(function (SignatureHelpTriggerKind) {
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["Invoke"] = 1] = "Invoke";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["TriggerCharacter"] = 2] = "TriggerCharacter";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["ContentChange"] = 3] = "ContentChange";
})(SignatureHelpTriggerKind || (SignatureHelpTriggerKind = {}));
/**
 * A symbol kind.
 */
var SymbolKind;
(function (SymbolKind) {
    SymbolKind[SymbolKind["File"] = 0] = "File";
    SymbolKind[SymbolKind["Module"] = 1] = "Module";
    SymbolKind[SymbolKind["Namespace"] = 2] = "Namespace";
    SymbolKind[SymbolKind["Package"] = 3] = "Package";
    SymbolKind[SymbolKind["Class"] = 4] = "Class";
    SymbolKind[SymbolKind["Method"] = 5] = "Method";
    SymbolKind[SymbolKind["Property"] = 6] = "Property";
    SymbolKind[SymbolKind["Field"] = 7] = "Field";
    SymbolKind[SymbolKind["Constructor"] = 8] = "Constructor";
    SymbolKind[SymbolKind["Enum"] = 9] = "Enum";
    SymbolKind[SymbolKind["Interface"] = 10] = "Interface";
    SymbolKind[SymbolKind["Function"] = 11] = "Function";
    SymbolKind[SymbolKind["Variable"] = 12] = "Variable";
    SymbolKind[SymbolKind["Constant"] = 13] = "Constant";
    SymbolKind[SymbolKind["String"] = 14] = "String";
    SymbolKind[SymbolKind["Number"] = 15] = "Number";
    SymbolKind[SymbolKind["Boolean"] = 16] = "Boolean";
    SymbolKind[SymbolKind["Array"] = 17] = "Array";
    SymbolKind[SymbolKind["Object"] = 18] = "Object";
    SymbolKind[SymbolKind["Key"] = 19] = "Key";
    SymbolKind[SymbolKind["Null"] = 20] = "Null";
    SymbolKind[SymbolKind["EnumMember"] = 21] = "EnumMember";
    SymbolKind[SymbolKind["Struct"] = 22] = "Struct";
    SymbolKind[SymbolKind["Event"] = 23] = "Event";
    SymbolKind[SymbolKind["Operator"] = 24] = "Operator";
    SymbolKind[SymbolKind["TypeParameter"] = 25] = "TypeParameter";
})(SymbolKind || (SymbolKind = {}));
var SymbolTag;
(function (SymbolTag) {
    SymbolTag[SymbolTag["Deprecated"] = 1] = "Deprecated";
})(SymbolTag || (SymbolTag = {}));
/**
 * The kind of animation in which the editor's cursor should be rendered.
 */
var TextEditorCursorBlinkingStyle;
(function (TextEditorCursorBlinkingStyle) {
    /**
     * Hidden
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Hidden"] = 0] = "Hidden";
    /**
     * Blinking
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Blink"] = 1] = "Blink";
    /**
     * Blinking with smooth fading
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Smooth"] = 2] = "Smooth";
    /**
     * Blinking with prolonged filled state and smooth fading
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Phase"] = 3] = "Phase";
    /**
     * Expand collapse animation on the y axis
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Expand"] = 4] = "Expand";
    /**
     * No-Blinking
     */
    TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle["Solid"] = 5] = "Solid";
})(TextEditorCursorBlinkingStyle || (TextEditorCursorBlinkingStyle = {}));
/**
 * The style in which the editor's cursor should be rendered.
 */
var TextEditorCursorStyle;
(function (TextEditorCursorStyle) {
    /**
     * As a vertical line (sitting between two characters).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["Line"] = 1] = "Line";
    /**
     * As a block (sitting on top of a character).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["Block"] = 2] = "Block";
    /**
     * As a horizontal line (sitting under a character).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["Underline"] = 3] = "Underline";
    /**
     * As a thin vertical line (sitting between two characters).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["LineThin"] = 4] = "LineThin";
    /**
     * As an outlined block (sitting on top of a character).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["BlockOutline"] = 5] = "BlockOutline";
    /**
     * As a thin horizontal line (sitting under a character).
     */
    TextEditorCursorStyle[TextEditorCursorStyle["UnderlineThin"] = 6] = "UnderlineThin";
})(TextEditorCursorStyle || (TextEditorCursorStyle = {}));
/**
 * Describes the behavior of decorations when typing/editing near their edges.
 * Note: Please do not edit the values, as they very carefully match `DecorationRangeBehavior`
 */
var TrackedRangeStickiness;
(function (TrackedRangeStickiness) {
    TrackedRangeStickiness[TrackedRangeStickiness["AlwaysGrowsWhenTypingAtEdges"] = 0] = "AlwaysGrowsWhenTypingAtEdges";
    TrackedRangeStickiness[TrackedRangeStickiness["NeverGrowsWhenTypingAtEdges"] = 1] = "NeverGrowsWhenTypingAtEdges";
    TrackedRangeStickiness[TrackedRangeStickiness["GrowsOnlyWhenTypingBefore"] = 2] = "GrowsOnlyWhenTypingBefore";
    TrackedRangeStickiness[TrackedRangeStickiness["GrowsOnlyWhenTypingAfter"] = 3] = "GrowsOnlyWhenTypingAfter";
})(TrackedRangeStickiness || (TrackedRangeStickiness = {}));
/**
 * Describes how to indent wrapped lines.
 */
var WrappingIndent;
(function (WrappingIndent) {
    /**
     * No indentation => wrapped lines begin at column 1.
     */
    WrappingIndent[WrappingIndent["None"] = 0] = "None";
    /**
     * Same => wrapped lines get the same indentation as the parent.
     */
    WrappingIndent[WrappingIndent["Same"] = 1] = "Same";
    /**
     * Indent => wrapped lines get +1 indentation toward the parent.
     */
    WrappingIndent[WrappingIndent["Indent"] = 2] = "Indent";
    /**
     * DeepIndent => wrapped lines get +2 indentation toward the parent.
     */
    WrappingIndent[WrappingIndent["DeepIndent"] = 3] = "DeepIndent";
})(WrappingIndent || (WrappingIndent = {}));

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class KeyMod {
    static chord(firstPart, secondPart) {
        return KeyChord(firstPart, secondPart);
    }
}
KeyMod.CtrlCmd = 2048 /* ConstKeyMod.CtrlCmd */;
KeyMod.Shift = 1024 /* ConstKeyMod.Shift */;
KeyMod.Alt = 512 /* ConstKeyMod.Alt */;
KeyMod.WinCtrl = 256 /* ConstKeyMod.WinCtrl */;
function createMonacoBaseAPI() {
    return {
        editor: undefined, // undefined override expected here
        languages: undefined, // undefined override expected here
        CancellationTokenSource: CancellationTokenSource,
        Emitter: Emitter,
        KeyCode: KeyCode,
        KeyMod: KeyMod,
        Position: Position,
        Range: Range,
        Selection: Selection,
        SelectionDirection: SelectionDirection,
        MarkerSeverity: MarkerSeverity,
        MarkerTag: MarkerTag,
        Uri: URI,
        Token: Token
    };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var _b;
class LinkedMap {
    constructor() {
        this[_b] = 'LinkedMap';
        this._map = new Map();
        this._head = undefined;
        this._tail = undefined;
        this._size = 0;
        this._state = 0;
    }
    clear() {
        this._map.clear();
        this._head = undefined;
        this._tail = undefined;
        this._size = 0;
        this._state++;
    }
    isEmpty() {
        return !this._head && !this._tail;
    }
    get size() {
        return this._size;
    }
    get first() {
        var _c;
        return (_c = this._head) === null || _c === void 0 ? void 0 : _c.value;
    }
    get last() {
        var _c;
        return (_c = this._tail) === null || _c === void 0 ? void 0 : _c.value;
    }
    has(key) {
        return this._map.has(key);
    }
    get(key, touch = 0 /* Touch.None */) {
        const item = this._map.get(key);
        if (!item) {
            return undefined;
        }
        if (touch !== 0 /* Touch.None */) {
            this.touch(item, touch);
        }
        return item.value;
    }
    set(key, value, touch = 0 /* Touch.None */) {
        let item = this._map.get(key);
        if (item) {
            item.value = value;
            if (touch !== 0 /* Touch.None */) {
                this.touch(item, touch);
            }
        }
        else {
            item = { key, value, next: undefined, previous: undefined };
            switch (touch) {
                case 0 /* Touch.None */:
                    this.addItemLast(item);
                    break;
                case 1 /* Touch.AsOld */:
                    this.addItemFirst(item);
                    break;
                case 2 /* Touch.AsNew */:
                    this.addItemLast(item);
                    break;
                default:
                    this.addItemLast(item);
                    break;
            }
            this._map.set(key, item);
            this._size++;
        }
        return this;
    }
    delete(key) {
        return !!this.remove(key);
    }
    remove(key) {
        const item = this._map.get(key);
        if (!item) {
            return undefined;
        }
        this._map.delete(key);
        this.removeItem(item);
        this._size--;
        return item.value;
    }
    shift() {
        if (!this._head && !this._tail) {
            return undefined;
        }
        if (!this._head || !this._tail) {
            throw new Error('Invalid list');
        }
        const item = this._head;
        this._map.delete(item.key);
        this.removeItem(item);
        this._size--;
        return item.value;
    }
    forEach(callbackfn, thisArg) {
        const state = this._state;
        let current = this._head;
        while (current) {
            if (thisArg) {
                callbackfn.bind(thisArg)(current.value, current.key, this);
            }
            else {
                callbackfn(current.value, current.key, this);
            }
            if (this._state !== state) {
                throw new Error(`LinkedMap got modified during iteration.`);
            }
            current = current.next;
        }
    }
    keys() {
        const map = this;
        const state = this._state;
        let current = this._head;
        const iterator = {
            [Symbol.iterator]() {
                return iterator;
            },
            next() {
                if (map._state !== state) {
                    throw new Error(`LinkedMap got modified during iteration.`);
                }
                if (current) {
                    const result = { value: current.key, done: false };
                    current = current.next;
                    return result;
                }
                else {
                    return { value: undefined, done: true };
                }
            }
        };
        return iterator;
    }
    values() {
        const map = this;
        const state = this._state;
        let current = this._head;
        const iterator = {
            [Symbol.iterator]() {
                return iterator;
            },
            next() {
                if (map._state !== state) {
                    throw new Error(`LinkedMap got modified during iteration.`);
                }
                if (current) {
                    const result = { value: current.value, done: false };
                    current = current.next;
                    return result;
                }
                else {
                    return { value: undefined, done: true };
                }
            }
        };
        return iterator;
    }
    entries() {
        const map = this;
        const state = this._state;
        let current = this._head;
        const iterator = {
            [Symbol.iterator]() {
                return iterator;
            },
            next() {
                if (map._state !== state) {
                    throw new Error(`LinkedMap got modified during iteration.`);
                }
                if (current) {
                    const result = { value: [current.key, current.value], done: false };
                    current = current.next;
                    return result;
                }
                else {
                    return { value: undefined, done: true };
                }
            }
        };
        return iterator;
    }
    [(_b = Symbol.toStringTag, Symbol.iterator)]() {
        return this.entries();
    }
    trimOld(newSize) {
        if (newSize >= this.size) {
            return;
        }
        if (newSize === 0) {
            this.clear();
            return;
        }
        let current = this._head;
        let currentSize = this.size;
        while (current && currentSize > newSize) {
            this._map.delete(current.key);
            current = current.next;
            currentSize--;
        }
        this._head = current;
        this._size = currentSize;
        if (current) {
            current.previous = undefined;
        }
        this._state++;
    }
    trimNew(newSize) {
        if (newSize >= this.size) {
            return;
        }
        if (newSize === 0) {
            this.clear();
            return;
        }
        let current = this._tail;
        let currentSize = this.size;
        while (current && currentSize > newSize) {
            this._map.delete(current.key);
            current = current.previous;
            currentSize--;
        }
        this._tail = current;
        this._size = currentSize;
        if (current) {
            current.next = undefined;
        }
        this._state++;
    }
    addItemFirst(item) {
        // First time Insert
        if (!this._head && !this._tail) {
            this._tail = item;
        }
        else if (!this._head) {
            throw new Error('Invalid list');
        }
        else {
            item.next = this._head;
            this._head.previous = item;
        }
        this._head = item;
        this._state++;
    }
    addItemLast(item) {
        // First time Insert
        if (!this._head && !this._tail) {
            this._head = item;
        }
        else if (!this._tail) {
            throw new Error('Invalid list');
        }
        else {
            item.previous = this._tail;
            this._tail.next = item;
        }
        this._tail = item;
        this._state++;
    }
    removeItem(item) {
        if (item === this._head && item === this._tail) {
            this._head = undefined;
            this._tail = undefined;
        }
        else if (item === this._head) {
            // This can only happen if size === 1 which is handled
            // by the case above.
            if (!item.next) {
                throw new Error('Invalid list');
            }
            item.next.previous = undefined;
            this._head = item.next;
        }
        else if (item === this._tail) {
            // This can only happen if size === 1 which is handled
            // by the case above.
            if (!item.previous) {
                throw new Error('Invalid list');
            }
            item.previous.next = undefined;
            this._tail = item.previous;
        }
        else {
            const next = item.next;
            const previous = item.previous;
            if (!next || !previous) {
                throw new Error('Invalid list');
            }
            next.previous = previous;
            previous.next = next;
        }
        item.next = undefined;
        item.previous = undefined;
        this._state++;
    }
    touch(item, touch) {
        if (!this._head || !this._tail) {
            throw new Error('Invalid list');
        }
        if ((touch !== 1 /* Touch.AsOld */ && touch !== 2 /* Touch.AsNew */)) {
            return;
        }
        if (touch === 1 /* Touch.AsOld */) {
            if (item === this._head) {
                return;
            }
            const next = item.next;
            const previous = item.previous;
            // Unlink the item
            if (item === this._tail) {
                // previous must be defined since item was not head but is tail
                // So there are more than on item in the map
                previous.next = undefined;
                this._tail = previous;
            }
            else {
                // Both next and previous are not undefined since item was neither head nor tail.
                next.previous = previous;
                previous.next = next;
            }
            // Insert the node at head
            item.previous = undefined;
            item.next = this._head;
            this._head.previous = item;
            this._head = item;
            this._state++;
        }
        else if (touch === 2 /* Touch.AsNew */) {
            if (item === this._tail) {
                return;
            }
            const next = item.next;
            const previous = item.previous;
            // Unlink the item.
            if (item === this._head) {
                // next must be defined since item was not tail but is head
                // So there are more than on item in the map
                next.previous = undefined;
                this._head = next;
            }
            else {
                // Both next and previous are not undefined since item was neither head nor tail.
                next.previous = previous;
                previous.next = next;
            }
            item.next = undefined;
            item.previous = this._tail;
            this._tail.next = item;
            this._tail = item;
            this._state++;
        }
    }
    toJSON() {
        const data = [];
        this.forEach((value, key) => {
            data.push([key, value]);
        });
        return data;
    }
    fromJSON(data) {
        this.clear();
        for (const [key, value] of data) {
            this.set(key, value);
        }
    }
}
class Cache extends LinkedMap {
    constructor(limit, ratio = 1) {
        super();
        this._limit = limit;
        this._ratio = Math.min(Math.max(0, ratio), 1);
    }
    get limit() {
        return this._limit;
    }
    set limit(limit) {
        this._limit = limit;
        this.checkTrim();
    }
    get(key, touch = 2 /* Touch.AsNew */) {
        return super.get(key, touch);
    }
    peek(key) {
        return super.get(key, 0 /* Touch.None */);
    }
    set(key, value) {
        super.set(key, value, 2 /* Touch.AsNew */);
        return this;
    }
    checkTrim() {
        if (this.size > this._limit) {
            this.trim(Math.round(this._limit * this._ratio));
        }
    }
}
class LRUCache extends Cache {
    constructor(limit, ratio = 1) {
        super(limit, ratio);
    }
    trim(newSize) {
        this.trimOld(newSize);
    }
    set(key, value) {
        super.set(key, value);
        this.checkTrim();
        return this;
    }
}
class SetMap {
    constructor() {
        this.map = new Map();
    }
    add(key, value) {
        let values = this.map.get(key);
        if (!values) {
            values = new Set();
            this.map.set(key, values);
        }
        values.add(value);
    }
    delete(key, value) {
        const values = this.map.get(key);
        if (!values) {
            return;
        }
        values.delete(value);
        if (values.size === 0) {
            this.map.delete(key);
        }
    }
    forEach(key, fn) {
        const values = this.map.get(key);
        if (!values) {
            return;
        }
        values.forEach(fn);
    }
    get(key) {
        const values = this.map.get(key);
        if (!values) {
            return new Set();
        }
        return values;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
new LRUCache(10);

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Vertical Lane in the overview ruler of the editor.
 */
var OverviewRulerLane;
(function (OverviewRulerLane) {
    OverviewRulerLane[OverviewRulerLane["Left"] = 1] = "Left";
    OverviewRulerLane[OverviewRulerLane["Center"] = 2] = "Center";
    OverviewRulerLane[OverviewRulerLane["Right"] = 4] = "Right";
    OverviewRulerLane[OverviewRulerLane["Full"] = 7] = "Full";
})(OverviewRulerLane || (OverviewRulerLane = {}));
/**
 * Vertical Lane in the glyph margin of the editor.
 */
var GlyphMarginLane;
(function (GlyphMarginLane) {
    GlyphMarginLane[GlyphMarginLane["Left"] = 1] = "Left";
    GlyphMarginLane[GlyphMarginLane["Center"] = 2] = "Center";
    GlyphMarginLane[GlyphMarginLane["Right"] = 3] = "Right";
})(GlyphMarginLane || (GlyphMarginLane = {}));
var InjectedTextCursorStops;
(function (InjectedTextCursorStops) {
    InjectedTextCursorStops[InjectedTextCursorStops["Both"] = 0] = "Both";
    InjectedTextCursorStops[InjectedTextCursorStops["Right"] = 1] = "Right";
    InjectedTextCursorStops[InjectedTextCursorStops["Left"] = 2] = "Left";
    InjectedTextCursorStops[InjectedTextCursorStops["None"] = 3] = "None";
})(InjectedTextCursorStops || (InjectedTextCursorStops = {}));

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function leftIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength) {
    if (matchStartIndex === 0) {
        // Match starts at start of string
        return true;
    }
    const charBefore = text.charCodeAt(matchStartIndex - 1);
    if (wordSeparators.get(charBefore) !== 0 /* WordCharacterClass.Regular */) {
        // The character before the match is a word separator
        return true;
    }
    if (charBefore === 13 /* CharCode.CarriageReturn */ || charBefore === 10 /* CharCode.LineFeed */) {
        // The character before the match is line break or carriage return.
        return true;
    }
    if (matchLength > 0) {
        const firstCharInMatch = text.charCodeAt(matchStartIndex);
        if (wordSeparators.get(firstCharInMatch) !== 0 /* WordCharacterClass.Regular */) {
            // The first character inside the match is a word separator
            return true;
        }
    }
    return false;
}
function rightIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength) {
    if (matchStartIndex + matchLength === textLength) {
        // Match ends at end of string
        return true;
    }
    const charAfter = text.charCodeAt(matchStartIndex + matchLength);
    if (wordSeparators.get(charAfter) !== 0 /* WordCharacterClass.Regular */) {
        // The character after the match is a word separator
        return true;
    }
    if (charAfter === 13 /* CharCode.CarriageReturn */ || charAfter === 10 /* CharCode.LineFeed */) {
        // The character after the match is line break or carriage return.
        return true;
    }
    if (matchLength > 0) {
        const lastCharInMatch = text.charCodeAt(matchStartIndex + matchLength - 1);
        if (wordSeparators.get(lastCharInMatch) !== 0 /* WordCharacterClass.Regular */) {
            // The last character in the match is a word separator
            return true;
        }
    }
    return false;
}
function isValidMatch(wordSeparators, text, textLength, matchStartIndex, matchLength) {
    return (leftIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength)
        && rightIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength));
}
class Searcher {
    constructor(wordSeparators, searchRegex) {
        this._wordSeparators = wordSeparators;
        this._searchRegex = searchRegex;
        this._prevMatchStartIndex = -1;
        this._prevMatchLength = 0;
    }
    reset(lastIndex) {
        this._searchRegex.lastIndex = lastIndex;
        this._prevMatchStartIndex = -1;
        this._prevMatchLength = 0;
    }
    next(text) {
        const textLength = text.length;
        let m;
        do {
            if (this._prevMatchStartIndex + this._prevMatchLength === textLength) {
                // Reached the end of the line
                return null;
            }
            m = this._searchRegex.exec(text);
            if (!m) {
                return null;
            }
            const matchStartIndex = m.index;
            const matchLength = m[0].length;
            if (matchStartIndex === this._prevMatchStartIndex && matchLength === this._prevMatchLength) {
                if (matchLength === 0) {
                    // the search result is an empty string and won't advance `regex.lastIndex`, so `regex.exec` will stuck here
                    // we attempt to recover from that by advancing by two if surrogate pair found and by one otherwise
                    if (getNextCodePoint(text, textLength, this._searchRegex.lastIndex) > 0xFFFF) {
                        this._searchRegex.lastIndex += 2;
                    }
                    else {
                        this._searchRegex.lastIndex += 1;
                    }
                    continue;
                }
                // Exit early if the regex matches the same range twice
                return null;
            }
            this._prevMatchStartIndex = matchStartIndex;
            this._prevMatchLength = matchLength;
            if (!this._wordSeparators || isValidMatch(this._wordSeparators, text, textLength, matchStartIndex, matchLength)) {
                return m;
            }
        } while (m);
        return null;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function assertNever(value, message = 'Unreachable') {
    throw new Error(message);
}
/**
 * condition must be side-effect free!
 */
function assertFn(condition) {
    if (!condition()) {
        // eslint-disable-next-line no-debugger
        debugger;
        // Reevaluate `condition` again to make debugging easier
        condition();
        onUnexpectedError(new BugIndicatingError('Assertion Failed'));
    }
}
function checkAdjacentItems(items, predicate) {
    let i = 0;
    while (i < items.length - 1) {
        const a = items[i];
        const b = items[i + 1];
        if (!predicate(a, b)) {
            return false;
        }
        i++;
    }
    return true;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class UnicodeTextModelHighlighter {
    static computeUnicodeHighlights(model, options, range) {
        const startLine = range ? range.startLineNumber : 1;
        const endLine = range ? range.endLineNumber : model.getLineCount();
        const codePointHighlighter = new CodePointHighlighter(options);
        const candidates = codePointHighlighter.getCandidateCodePoints();
        let regex;
        if (candidates === 'allNonBasicAscii') {
            regex = new RegExp('[^\\t\\n\\r\\x20-\\x7E]', 'g');
        }
        else {
            regex = new RegExp(`${buildRegExpCharClassExpr(Array.from(candidates))}`, 'g');
        }
        const searcher = new Searcher(null, regex);
        const ranges = [];
        let hasMore = false;
        let m;
        let ambiguousCharacterCount = 0;
        let invisibleCharacterCount = 0;
        let nonBasicAsciiCharacterCount = 0;
        forLoop: for (let lineNumber = startLine, lineCount = endLine; lineNumber <= lineCount; lineNumber++) {
            const lineContent = model.getLineContent(lineNumber);
            const lineLength = lineContent.length;
            // Reset regex to search from the beginning
            searcher.reset(0);
            do {
                m = searcher.next(lineContent);
                if (m) {
                    let startIndex = m.index;
                    let endIndex = m.index + m[0].length;
                    // Extend range to entire code point
                    if (startIndex > 0) {
                        const charCodeBefore = lineContent.charCodeAt(startIndex - 1);
                        if (isHighSurrogate(charCodeBefore)) {
                            startIndex--;
                        }
                    }
                    if (endIndex + 1 < lineLength) {
                        const charCodeBefore = lineContent.charCodeAt(endIndex - 1);
                        if (isHighSurrogate(charCodeBefore)) {
                            endIndex++;
                        }
                    }
                    const str = lineContent.substring(startIndex, endIndex);
                    let word = getWordAtText(startIndex + 1, DEFAULT_WORD_REGEXP, lineContent, 0);
                    if (word && word.endColumn <= startIndex + 1) {
                        // The word does not include the problematic character, ignore the word
                        word = null;
                    }
                    const highlightReason = codePointHighlighter.shouldHighlightNonBasicASCII(str, word ? word.word : null);
                    if (highlightReason !== 0 /* SimpleHighlightReason.None */) {
                        if (highlightReason === 3 /* SimpleHighlightReason.Ambiguous */) {
                            ambiguousCharacterCount++;
                        }
                        else if (highlightReason === 2 /* SimpleHighlightReason.Invisible */) {
                            invisibleCharacterCount++;
                        }
                        else if (highlightReason === 1 /* SimpleHighlightReason.NonBasicASCII */) {
                            nonBasicAsciiCharacterCount++;
                        }
                        else {
                            assertNever();
                        }
                        const MAX_RESULT_LENGTH = 1000;
                        if (ranges.length >= MAX_RESULT_LENGTH) {
                            hasMore = true;
                            break forLoop;
                        }
                        ranges.push(new Range(lineNumber, startIndex + 1, lineNumber, endIndex + 1));
                    }
                }
            } while (m);
        }
        return {
            ranges,
            hasMore,
            ambiguousCharacterCount,
            invisibleCharacterCount,
            nonBasicAsciiCharacterCount
        };
    }
    static computeUnicodeHighlightReason(char, options) {
        const codePointHighlighter = new CodePointHighlighter(options);
        const reason = codePointHighlighter.shouldHighlightNonBasicASCII(char, null);
        switch (reason) {
            case 0 /* SimpleHighlightReason.None */:
                return null;
            case 2 /* SimpleHighlightReason.Invisible */:
                return { kind: 1 /* UnicodeHighlighterReasonKind.Invisible */ };
            case 3 /* SimpleHighlightReason.Ambiguous */: {
                const codePoint = char.codePointAt(0);
                const primaryConfusable = codePointHighlighter.ambiguousCharacters.getPrimaryConfusable(codePoint);
                const notAmbiguousInLocales = AmbiguousCharacters.getLocales().filter((l) => !AmbiguousCharacters.getInstance(new Set([...options.allowedLocales, l])).isAmbiguous(codePoint));
                return { kind: 0 /* UnicodeHighlighterReasonKind.Ambiguous */, confusableWith: String.fromCodePoint(primaryConfusable), notAmbiguousInLocales };
            }
            case 1 /* SimpleHighlightReason.NonBasicASCII */:
                return { kind: 2 /* UnicodeHighlighterReasonKind.NonBasicAscii */ };
        }
    }
}
function buildRegExpCharClassExpr(codePoints, flags) {
    const src = `[${escapeRegExpCharacters(codePoints.map((i) => String.fromCodePoint(i)).join(''))}]`;
    return src;
}
class CodePointHighlighter {
    constructor(options) {
        this.options = options;
        this.allowedCodePoints = new Set(options.allowedCodePoints);
        this.ambiguousCharacters = AmbiguousCharacters.getInstance(new Set(options.allowedLocales));
    }
    getCandidateCodePoints() {
        if (this.options.nonBasicASCII) {
            return 'allNonBasicAscii';
        }
        const set = new Set();
        if (this.options.invisibleCharacters) {
            for (const cp of InvisibleCharacters.codePoints) {
                if (!isAllowedInvisibleCharacter(String.fromCodePoint(cp))) {
                    set.add(cp);
                }
            }
        }
        if (this.options.ambiguousCharacters) {
            for (const cp of this.ambiguousCharacters.getConfusableCodePoints()) {
                set.add(cp);
            }
        }
        for (const cp of this.allowedCodePoints) {
            set.delete(cp);
        }
        return set;
    }
    shouldHighlightNonBasicASCII(character, wordContext) {
        const codePoint = character.codePointAt(0);
        if (this.allowedCodePoints.has(codePoint)) {
            return 0 /* SimpleHighlightReason.None */;
        }
        if (this.options.nonBasicASCII) {
            return 1 /* SimpleHighlightReason.NonBasicASCII */;
        }
        let hasBasicASCIICharacters = false;
        let hasNonConfusableNonBasicAsciiCharacter = false;
        if (wordContext) {
            for (const char of wordContext) {
                const codePoint = char.codePointAt(0);
                const isBasicASCII$1 = isBasicASCII(char);
                hasBasicASCIICharacters = hasBasicASCIICharacters || isBasicASCII$1;
                if (!isBasicASCII$1 &&
                    !this.ambiguousCharacters.isAmbiguous(codePoint) &&
                    !InvisibleCharacters.isInvisibleCharacter(codePoint)) {
                    hasNonConfusableNonBasicAsciiCharacter = true;
                }
            }
        }
        if (
        /* Don't allow mixing weird looking characters with ASCII */ !hasBasicASCIICharacters &&
            /* Is there an obviously weird looking character? */ hasNonConfusableNonBasicAsciiCharacter) {
            return 0 /* SimpleHighlightReason.None */;
        }
        if (this.options.invisibleCharacters) {
            // TODO check for emojis
            if (!isAllowedInvisibleCharacter(character) && InvisibleCharacters.isInvisibleCharacter(codePoint)) {
                return 2 /* SimpleHighlightReason.Invisible */;
            }
        }
        if (this.options.ambiguousCharacters) {
            if (this.ambiguousCharacters.isAmbiguous(codePoint)) {
                return 3 /* SimpleHighlightReason.Ambiguous */;
            }
        }
        return 0 /* SimpleHighlightReason.None */;
    }
}
function isAllowedInvisibleCharacter(character) {
    return character === ' ' || character === '\n' || character === '\t';
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class LinesDiff {
    constructor(changes, 
    /**
     * Sorted by original line ranges.
     * The original line ranges and the modified line ranges must be disjoint (but can be touching).
     */
    moves, 
    /**
     * Indicates if the time out was reached.
     * In that case, the diffs might be an approximation and the user should be asked to rerun the diff with more time.
     */
    hitTimeout) {
        this.changes = changes;
        this.moves = moves;
        this.hitTimeout = hitTimeout;
    }
}
class MovedText {
    constructor(lineRangeMapping, changes) {
        this.lineRangeMapping = lineRangeMapping;
        this.changes = changes;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A range of offsets (0-based).
*/
class OffsetRange {
    static addRange(range, sortedRanges) {
        let i = 0;
        while (i < sortedRanges.length && sortedRanges[i].endExclusive < range.start) {
            i++;
        }
        let j = i;
        while (j < sortedRanges.length && sortedRanges[j].start <= range.endExclusive) {
            j++;
        }
        if (i === j) {
            sortedRanges.splice(i, 0, range);
        }
        else {
            const start = Math.min(range.start, sortedRanges[i].start);
            const end = Math.max(range.endExclusive, sortedRanges[j - 1].endExclusive);
            sortedRanges.splice(i, j - i, new OffsetRange(start, end));
        }
    }
    static tryCreate(start, endExclusive) {
        if (start > endExclusive) {
            return undefined;
        }
        return new OffsetRange(start, endExclusive);
    }
    static ofLength(length) {
        return new OffsetRange(0, length);
    }
    static ofStartAndLength(start, length) {
        return new OffsetRange(start, start + length);
    }
    constructor(start, endExclusive) {
        this.start = start;
        this.endExclusive = endExclusive;
        if (start > endExclusive) {
            throw new BugIndicatingError(`Invalid range: ${this.toString()}`);
        }
    }
    get isEmpty() {
        return this.start === this.endExclusive;
    }
    delta(offset) {
        return new OffsetRange(this.start + offset, this.endExclusive + offset);
    }
    deltaStart(offset) {
        return new OffsetRange(this.start + offset, this.endExclusive);
    }
    deltaEnd(offset) {
        return new OffsetRange(this.start, this.endExclusive + offset);
    }
    get length() {
        return this.endExclusive - this.start;
    }
    toString() {
        return `[${this.start}, ${this.endExclusive})`;
    }
    contains(offset) {
        return this.start <= offset && offset < this.endExclusive;
    }
    /**
     * for all numbers n: range1.contains(n) or range2.contains(n) => range1.join(range2).contains(n)
     * The joined range is the smallest range that contains both ranges.
     */
    join(other) {
        return new OffsetRange(Math.min(this.start, other.start), Math.max(this.endExclusive, other.endExclusive));
    }
    /**
     * for all numbers n: range1.contains(n) and range2.contains(n) <=> range1.intersect(range2).contains(n)
     *
     * The resulting range is empty if the ranges do not intersect, but touch.
     * If the ranges don't even touch, the result is undefined.
     */
    intersect(other) {
        const start = Math.max(this.start, other.start);
        const end = Math.min(this.endExclusive, other.endExclusive);
        if (start <= end) {
            return new OffsetRange(start, end);
        }
        return undefined;
    }
    intersects(other) {
        const start = Math.max(this.start, other.start);
        const end = Math.min(this.endExclusive, other.endExclusive);
        return start < end;
    }
    isBefore(other) {
        return this.endExclusive <= other.start;
    }
    isAfter(other) {
        return this.start >= other.endExclusive;
    }
    slice(arr) {
        return arr.slice(this.start, this.endExclusive);
    }
    substring(str) {
        return str.substring(this.start, this.endExclusive);
    }
    /**
     * Returns the given value if it is contained in this instance, otherwise the closest value that is contained.
     * The range must not be empty.
     */
    clip(value) {
        if (this.isEmpty) {
            throw new BugIndicatingError(`Invalid clipping range: ${this.toString()}`);
        }
        return Math.max(this.start, Math.min(this.endExclusive - 1, value));
    }
    /**
     * Returns `r := value + k * length` such that `r` is contained in this range.
     * The range must not be empty.
     *
     * E.g. `[5, 10).clipCyclic(10) === 5`, `[5, 10).clipCyclic(11) === 6` and `[5, 10).clipCyclic(4) === 9`.
     */
    clipCyclic(value) {
        if (this.isEmpty) {
            throw new BugIndicatingError(`Invalid clipping range: ${this.toString()}`);
        }
        if (value < this.start) {
            return this.endExclusive - ((this.start - value) % this.length);
        }
        if (value >= this.endExclusive) {
            return this.start + ((value - this.start) % this.length);
        }
        return value;
    }
    forEach(f) {
        for (let i = this.start; i < this.endExclusive; i++) {
            f(i);
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Finds the last item where predicate is true using binary search.
 * `predicate` must be monotonous, i.e. `arr.map(predicate)` must be like `[true, ..., true, false, ..., false]`!
 *
 * @returns `undefined` if no item matches, otherwise the last item that matches the predicate.
 */
function findLastMonotonous(array, predicate) {
    const idx = findLastIdxMonotonous(array, predicate);
    return idx === -1 ? undefined : array[idx];
}
/**
 * Finds the last item where predicate is true using binary search.
 * `predicate` must be monotonous, i.e. `arr.map(predicate)` must be like `[true, ..., true, false, ..., false]`!
 *
 * @returns `startIdx - 1` if predicate is false for all items, otherwise the index of the last item that matches the predicate.
 */
function findLastIdxMonotonous(array, predicate, startIdx = 0, endIdxEx = array.length) {
    let i = startIdx;
    let j = endIdxEx;
    while (i < j) {
        const k = Math.floor((i + j) / 2);
        if (predicate(array[k])) {
            i = k + 1;
        }
        else {
            j = k;
        }
    }
    return i - 1;
}
/**
 * Finds the first item where predicate is true using binary search.
 * `predicate` must be monotonous, i.e. `arr.map(predicate)` must be like `[false, ..., false, true, ..., true]`!
 *
 * @returns `undefined` if no item matches, otherwise the first item that matches the predicate.
 */
function findFirstMonotonous(array, predicate) {
    const idx = findFirstIdxMonotonousOrArrLen(array, predicate);
    return idx === array.length ? undefined : array[idx];
}
/**
 * Finds the first item where predicate is true using binary search.
 * `predicate` must be monotonous, i.e. `arr.map(predicate)` must be like `[false, ..., false, true, ..., true]`!
 *
 * @returns `endIdxEx` if predicate is false for all items, otherwise the index of the first item that matches the predicate.
 */
function findFirstIdxMonotonousOrArrLen(array, predicate, startIdx = 0, endIdxEx = array.length) {
    let i = startIdx;
    let j = endIdxEx;
    while (i < j) {
        const k = Math.floor((i + j) / 2);
        if (predicate(array[k])) {
            j = k;
        }
        else {
            i = k + 1;
        }
    }
    return i;
}
/**
 * Use this when
 * * You have a sorted array
 * * You query this array with a monotonous predicate to find the last item that has a certain property.
 * * You query this array multiple times with monotonous predicates that get weaker and weaker.
 */
class MonotonousArray {
    constructor(_array) {
        this._array = _array;
        this._findLastMonotonousLastIdx = 0;
    }
    /**
     * The predicate must be monotonous, i.e. `arr.map(predicate)` must be like `[true, ..., true, false, ..., false]`!
     * For subsequent calls, current predicate must be weaker than (or equal to) the previous predicate, i.e. more entries must be `true`.
     */
    findLastMonotonous(predicate) {
        if (MonotonousArray.assertInvariants) {
            if (this._prevFindLastPredicate) {
                for (const item of this._array) {
                    if (this._prevFindLastPredicate(item) && !predicate(item)) {
                        throw new Error('MonotonousArray: current predicate must be weaker than (or equal to) the previous predicate.');
                    }
                }
            }
            this._prevFindLastPredicate = predicate;
        }
        const idx = findLastIdxMonotonous(this._array, predicate, this._findLastMonotonousLastIdx);
        this._findLastMonotonousLastIdx = idx + 1;
        return idx === -1 ? undefined : this._array[idx];
    }
}
MonotonousArray.assertInvariants = false;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A range of lines (1-based).
 */
class LineRange {
    static fromRangeInclusive(range) {
        return new LineRange(range.startLineNumber, range.endLineNumber + 1);
    }
    /**
     * @param lineRanges An array of sorted line ranges.
     */
    static joinMany(lineRanges) {
        if (lineRanges.length === 0) {
            return [];
        }
        let result = new LineRangeSet(lineRanges[0].slice());
        for (let i = 1; i < lineRanges.length; i++) {
            result = result.getUnion(new LineRangeSet(lineRanges[i].slice()));
        }
        return result.ranges;
    }
    static join(lineRanges) {
        if (lineRanges.length === 0) {
            throw new BugIndicatingError('lineRanges cannot be empty');
        }
        let startLineNumber = lineRanges[0].startLineNumber;
        let endLineNumberExclusive = lineRanges[0].endLineNumberExclusive;
        for (let i = 1; i < lineRanges.length; i++) {
            startLineNumber = Math.min(startLineNumber, lineRanges[i].startLineNumber);
            endLineNumberExclusive = Math.max(endLineNumberExclusive, lineRanges[i].endLineNumberExclusive);
        }
        return new LineRange(startLineNumber, endLineNumberExclusive);
    }
    static ofLength(startLineNumber, length) {
        return new LineRange(startLineNumber, startLineNumber + length);
    }
    /**
     * @internal
     */
    static deserialize(lineRange) {
        return new LineRange(lineRange[0], lineRange[1]);
    }
    constructor(startLineNumber, endLineNumberExclusive) {
        if (startLineNumber > endLineNumberExclusive) {
            throw new BugIndicatingError(`startLineNumber ${startLineNumber} cannot be after endLineNumberExclusive ${endLineNumberExclusive}`);
        }
        this.startLineNumber = startLineNumber;
        this.endLineNumberExclusive = endLineNumberExclusive;
    }
    /**
     * Indicates if this line range contains the given line number.
     */
    contains(lineNumber) {
        return this.startLineNumber <= lineNumber && lineNumber < this.endLineNumberExclusive;
    }
    /**
     * Indicates if this line range is empty.
     */
    get isEmpty() {
        return this.startLineNumber === this.endLineNumberExclusive;
    }
    /**
     * Moves this line range by the given offset of line numbers.
     */
    delta(offset) {
        return new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive + offset);
    }
    deltaLength(offset) {
        return new LineRange(this.startLineNumber, this.endLineNumberExclusive + offset);
    }
    /**
     * The number of lines this line range spans.
     */
    get length() {
        return this.endLineNumberExclusive - this.startLineNumber;
    }
    /**
     * Creates a line range that combines this and the given line range.
     */
    join(other) {
        return new LineRange(Math.min(this.startLineNumber, other.startLineNumber), Math.max(this.endLineNumberExclusive, other.endLineNumberExclusive));
    }
    toString() {
        return `[${this.startLineNumber},${this.endLineNumberExclusive})`;
    }
    /**
     * The resulting range is empty if the ranges do not intersect, but touch.
     * If the ranges don't even touch, the result is undefined.
     */
    intersect(other) {
        const startLineNumber = Math.max(this.startLineNumber, other.startLineNumber);
        const endLineNumberExclusive = Math.min(this.endLineNumberExclusive, other.endLineNumberExclusive);
        if (startLineNumber <= endLineNumberExclusive) {
            return new LineRange(startLineNumber, endLineNumberExclusive);
        }
        return undefined;
    }
    intersectsStrict(other) {
        return this.startLineNumber < other.endLineNumberExclusive && other.startLineNumber < this.endLineNumberExclusive;
    }
    overlapOrTouch(other) {
        return this.startLineNumber <= other.endLineNumberExclusive && other.startLineNumber <= this.endLineNumberExclusive;
    }
    equals(b) {
        return this.startLineNumber === b.startLineNumber && this.endLineNumberExclusive === b.endLineNumberExclusive;
    }
    toInclusiveRange() {
        if (this.isEmpty) {
            return null;
        }
        return new Range(this.startLineNumber, 1, this.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER);
    }
    /**
     * @deprecated Using this function is discouraged because it might lead to bugs: The end position is not guaranteed to be a valid position!
    */
    toExclusiveRange() {
        return new Range(this.startLineNumber, 1, this.endLineNumberExclusive, 1);
    }
    mapToLineArray(f) {
        const result = [];
        for (let lineNumber = this.startLineNumber; lineNumber < this.endLineNumberExclusive; lineNumber++) {
            result.push(f(lineNumber));
        }
        return result;
    }
    forEach(f) {
        for (let lineNumber = this.startLineNumber; lineNumber < this.endLineNumberExclusive; lineNumber++) {
            f(lineNumber);
        }
    }
    /**
     * @internal
     */
    serialize() {
        return [this.startLineNumber, this.endLineNumberExclusive];
    }
    includes(lineNumber) {
        return this.startLineNumber <= lineNumber && lineNumber < this.endLineNumberExclusive;
    }
    /**
     * Converts this 1-based line range to a 0-based offset range (subtracts 1!).
     * @internal
     */
    toOffsetRange() {
        return new OffsetRange(this.startLineNumber - 1, this.endLineNumberExclusive - 1);
    }
}
class LineRangeSet {
    constructor(
    /**
     * Sorted by start line number.
     * No two line ranges are touching or intersecting.
     */
    _normalizedRanges = []) {
        this._normalizedRanges = _normalizedRanges;
    }
    get ranges() {
        return this._normalizedRanges;
    }
    addRange(range) {
        if (range.length === 0) {
            return;
        }
        // Idea: Find joinRange such that:
        // replaceRange = _normalizedRanges.replaceRange(joinRange, range.joinAll(joinRange.map(idx => this._normalizedRanges[idx])))
        // idx of first element that touches range or that is after range
        const joinRangeStartIdx = findFirstIdxMonotonousOrArrLen(this._normalizedRanges, r => r.endLineNumberExclusive >= range.startLineNumber);
        // idx of element after { last element that touches range or that is before range }
        const joinRangeEndIdxExclusive = findLastIdxMonotonous(this._normalizedRanges, r => r.startLineNumber <= range.endLineNumberExclusive) + 1;
        if (joinRangeStartIdx === joinRangeEndIdxExclusive) {
            // If there is no element that touches range, then joinRangeStartIdx === joinRangeEndIdxExclusive and that value is the index of the element after range
            this._normalizedRanges.splice(joinRangeStartIdx, 0, range);
        }
        else if (joinRangeStartIdx === joinRangeEndIdxExclusive - 1) {
            // Else, there is an element that touches range and in this case it is both the first and last element. Thus we can replace it
            const joinRange = this._normalizedRanges[joinRangeStartIdx];
            this._normalizedRanges[joinRangeStartIdx] = joinRange.join(range);
        }
        else {
            // First and last element are different - we need to replace the entire range
            const joinRange = this._normalizedRanges[joinRangeStartIdx].join(this._normalizedRanges[joinRangeEndIdxExclusive - 1]).join(range);
            this._normalizedRanges.splice(joinRangeStartIdx, joinRangeEndIdxExclusive - joinRangeStartIdx, joinRange);
        }
    }
    contains(lineNumber) {
        const rangeThatStartsBeforeEnd = findLastMonotonous(this._normalizedRanges, r => r.startLineNumber <= lineNumber);
        return !!rangeThatStartsBeforeEnd && rangeThatStartsBeforeEnd.endLineNumberExclusive > lineNumber;
    }
    intersects(range) {
        const rangeThatStartsBeforeEnd = findLastMonotonous(this._normalizedRanges, r => r.startLineNumber < range.endLineNumberExclusive);
        return !!rangeThatStartsBeforeEnd && rangeThatStartsBeforeEnd.endLineNumberExclusive > range.startLineNumber;
    }
    getUnion(other) {
        if (this._normalizedRanges.length === 0) {
            return other;
        }
        if (other._normalizedRanges.length === 0) {
            return this;
        }
        const result = [];
        let i1 = 0;
        let i2 = 0;
        let current = null;
        while (i1 < this._normalizedRanges.length || i2 < other._normalizedRanges.length) {
            let next = null;
            if (i1 < this._normalizedRanges.length && i2 < other._normalizedRanges.length) {
                const lineRange1 = this._normalizedRanges[i1];
                const lineRange2 = other._normalizedRanges[i2];
                if (lineRange1.startLineNumber < lineRange2.startLineNumber) {
                    next = lineRange1;
                    i1++;
                }
                else {
                    next = lineRange2;
                    i2++;
                }
            }
            else if (i1 < this._normalizedRanges.length) {
                next = this._normalizedRanges[i1];
                i1++;
            }
            else {
                next = other._normalizedRanges[i2];
                i2++;
            }
            if (current === null) {
                current = next;
            }
            else {
                if (current.endLineNumberExclusive >= next.startLineNumber) {
                    // merge
                    current = new LineRange(current.startLineNumber, Math.max(current.endLineNumberExclusive, next.endLineNumberExclusive));
                }
                else {
                    // push
                    result.push(current);
                    current = next;
                }
            }
        }
        if (current !== null) {
            result.push(current);
        }
        return new LineRangeSet(result);
    }
    /**
     * Subtracts all ranges in this set from `range` and returns the result.
     */
    subtractFrom(range) {
        // idx of first element that touches range or that is after range
        const joinRangeStartIdx = findFirstIdxMonotonousOrArrLen(this._normalizedRanges, r => r.endLineNumberExclusive >= range.startLineNumber);
        // idx of element after { last element that touches range or that is before range }
        const joinRangeEndIdxExclusive = findLastIdxMonotonous(this._normalizedRanges, r => r.startLineNumber <= range.endLineNumberExclusive) + 1;
        if (joinRangeStartIdx === joinRangeEndIdxExclusive) {
            return new LineRangeSet([range]);
        }
        const result = [];
        let startLineNumber = range.startLineNumber;
        for (let i = joinRangeStartIdx; i < joinRangeEndIdxExclusive; i++) {
            const r = this._normalizedRanges[i];
            if (r.startLineNumber > startLineNumber) {
                result.push(new LineRange(startLineNumber, r.startLineNumber));
            }
            startLineNumber = r.endLineNumberExclusive;
        }
        if (startLineNumber < range.endLineNumberExclusive) {
            result.push(new LineRange(startLineNumber, range.endLineNumberExclusive));
        }
        return new LineRangeSet(result);
    }
    toString() {
        return this._normalizedRanges.map(r => r.toString()).join(', ');
    }
    getIntersection(other) {
        const result = [];
        let i1 = 0;
        let i2 = 0;
        while (i1 < this._normalizedRanges.length && i2 < other._normalizedRanges.length) {
            const r1 = this._normalizedRanges[i1];
            const r2 = other._normalizedRanges[i2];
            const i = r1.intersect(r2);
            if (i && !i.isEmpty) {
                result.push(i);
            }
            if (r1.endLineNumberExclusive < r2.endLineNumberExclusive) {
                i1++;
            }
            else {
                i2++;
            }
        }
        return new LineRangeSet(result);
    }
    getWithDelta(value) {
        return new LineRangeSet(this._normalizedRanges.map(r => r.delta(value)));
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class SingleTextEdit {
    constructor(range, text) {
        this.range = range;
        this.text = text;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Maps a line range in the original text model to a line range in the modified text model.
 */
class LineRangeMapping {
    static inverse(mapping, originalLineCount, modifiedLineCount) {
        const result = [];
        let lastOriginalEndLineNumber = 1;
        let lastModifiedEndLineNumber = 1;
        for (const m of mapping) {
            const r = new LineRangeMapping(new LineRange(lastOriginalEndLineNumber, m.original.startLineNumber), new LineRange(lastModifiedEndLineNumber, m.modified.startLineNumber));
            if (!r.modified.isEmpty) {
                result.push(r);
            }
            lastOriginalEndLineNumber = m.original.endLineNumberExclusive;
            lastModifiedEndLineNumber = m.modified.endLineNumberExclusive;
        }
        const r = new LineRangeMapping(new LineRange(lastOriginalEndLineNumber, originalLineCount + 1), new LineRange(lastModifiedEndLineNumber, modifiedLineCount + 1));
        if (!r.modified.isEmpty) {
            result.push(r);
        }
        return result;
    }
    static clip(mapping, originalRange, modifiedRange) {
        const result = [];
        for (const m of mapping) {
            const original = m.original.intersect(originalRange);
            const modified = m.modified.intersect(modifiedRange);
            if (original && !original.isEmpty && modified && !modified.isEmpty) {
                result.push(new LineRangeMapping(original, modified));
            }
        }
        return result;
    }
    constructor(originalRange, modifiedRange) {
        this.original = originalRange;
        this.modified = modifiedRange;
    }
    toString() {
        return `{${this.original.toString()}->${this.modified.toString()}}`;
    }
    flip() {
        return new LineRangeMapping(this.modified, this.original);
    }
    join(other) {
        return new LineRangeMapping(this.original.join(other.original), this.modified.join(other.modified));
    }
    /**
     * This method assumes that the LineRangeMapping describes a valid diff!
     * I.e. if one range is empty, the other range cannot be the entire document.
     * It avoids various problems when the line range points to non-existing line-numbers.
    */
    toRangeMapping() {
        const origInclusiveRange = this.original.toInclusiveRange();
        const modInclusiveRange = this.modified.toInclusiveRange();
        if (origInclusiveRange && modInclusiveRange) {
            return new RangeMapping(origInclusiveRange, modInclusiveRange);
        }
        else if (this.original.startLineNumber === 1 || this.modified.startLineNumber === 1) {
            if (!(this.modified.startLineNumber === 1 && this.original.startLineNumber === 1)) {
                // If one line range starts at 1, the other one must start at 1 as well.
                throw new BugIndicatingError('not a valid diff');
            }
            // Because one range is empty and both ranges start at line 1, none of the ranges can cover all lines.
            // Thus, `endLineNumberExclusive` is a valid line number.
            return new RangeMapping(new Range(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new Range(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
        }
        else {
            // We can assume here that both startLineNumbers are greater than 1.
            return new RangeMapping(new Range(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), new Range(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER));
        }
    }
}
/**
 * Maps a line range in the original text model to a line range in the modified text model.
 * Also contains inner range mappings.
 */
class DetailedLineRangeMapping extends LineRangeMapping {
    static fromRangeMappings(rangeMappings) {
        const originalRange = LineRange.join(rangeMappings.map(r => LineRange.fromRangeInclusive(r.originalRange)));
        const modifiedRange = LineRange.join(rangeMappings.map(r => LineRange.fromRangeInclusive(r.modifiedRange)));
        return new DetailedLineRangeMapping(originalRange, modifiedRange, rangeMappings);
    }
    constructor(originalRange, modifiedRange, innerChanges) {
        super(originalRange, modifiedRange);
        this.innerChanges = innerChanges;
    }
    flip() {
        var _a;
        return new DetailedLineRangeMapping(this.modified, this.original, (_a = this.innerChanges) === null || _a === void 0 ? void 0 : _a.map(c => c.flip()));
    }
    withInnerChangesFromLineRanges() {
        return new DetailedLineRangeMapping(this.original, this.modified, [this.toRangeMapping()]);
    }
}
/**
 * Maps a range in the original text model to a range in the modified text model.
 */
class RangeMapping {
    constructor(originalRange, modifiedRange) {
        this.originalRange = originalRange;
        this.modifiedRange = modifiedRange;
    }
    toString() {
        return `{${this.originalRange.toString()}->${this.modifiedRange.toString()}}`;
    }
    flip() {
        return new RangeMapping(this.modifiedRange, this.originalRange);
    }
    /**
     * Creates a single text edit that describes the change from the original to the modified text.
    */
    toTextEdit(modified) {
        const newText = modified.getValueOfRange(this.modifiedRange);
        return new SingleTextEdit(this.originalRange, newText);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const MINIMUM_MATCHING_CHARACTER_LENGTH = 3;
class LegacyLinesDiffComputer {
    computeDiff(originalLines, modifiedLines, options) {
        var _a;
        const diffComputer = new DiffComputer(originalLines, modifiedLines, {
            maxComputationTime: options.maxComputationTimeMs,
            shouldIgnoreTrimWhitespace: options.ignoreTrimWhitespace,
            shouldComputeCharChanges: true,
            shouldMakePrettyDiff: true,
            shouldPostProcessCharChanges: true,
        });
        const result = diffComputer.computeDiff();
        const changes = [];
        let lastChange = null;
        for (const c of result.changes) {
            let originalRange;
            if (c.originalEndLineNumber === 0) {
                // Insertion
                originalRange = new LineRange(c.originalStartLineNumber + 1, c.originalStartLineNumber + 1);
            }
            else {
                originalRange = new LineRange(c.originalStartLineNumber, c.originalEndLineNumber + 1);
            }
            let modifiedRange;
            if (c.modifiedEndLineNumber === 0) {
                // Deletion
                modifiedRange = new LineRange(c.modifiedStartLineNumber + 1, c.modifiedStartLineNumber + 1);
            }
            else {
                modifiedRange = new LineRange(c.modifiedStartLineNumber, c.modifiedEndLineNumber + 1);
            }
            let change = new DetailedLineRangeMapping(originalRange, modifiedRange, (_a = c.charChanges) === null || _a === void 0 ? void 0 : _a.map(c => new RangeMapping(new Range(c.originalStartLineNumber, c.originalStartColumn, c.originalEndLineNumber, c.originalEndColumn), new Range(c.modifiedStartLineNumber, c.modifiedStartColumn, c.modifiedEndLineNumber, c.modifiedEndColumn))));
            if (lastChange) {
                if (lastChange.modified.endLineNumberExclusive === change.modified.startLineNumber
                    || lastChange.original.endLineNumberExclusive === change.original.startLineNumber) {
                    // join touching diffs. Probably moving diffs up/down in the algorithm causes touching diffs.
                    change = new DetailedLineRangeMapping(lastChange.original.join(change.original), lastChange.modified.join(change.modified), lastChange.innerChanges && change.innerChanges ?
                        lastChange.innerChanges.concat(change.innerChanges) : undefined);
                    changes.pop();
                }
            }
            changes.push(change);
            lastChange = change;
        }
        assertFn(() => {
            return checkAdjacentItems(changes, (m1, m2) => m2.original.startLineNumber - m1.original.endLineNumberExclusive === m2.modified.startLineNumber - m1.modified.endLineNumberExclusive &&
                // There has to be an unchanged line in between (otherwise both diffs should have been joined)
                m1.original.endLineNumberExclusive < m2.original.startLineNumber &&
                m1.modified.endLineNumberExclusive < m2.modified.startLineNumber);
        });
        return new LinesDiff(changes, [], result.quitEarly);
    }
}
function computeDiff(originalSequence, modifiedSequence, continueProcessingPredicate, pretty) {
    const diffAlgo = new LcsDiff(originalSequence, modifiedSequence, continueProcessingPredicate);
    return diffAlgo.ComputeDiff(pretty);
}
let LineSequence$1 = class LineSequence {
    constructor(lines) {
        const startColumns = [];
        const endColumns = [];
        for (let i = 0, length = lines.length; i < length; i++) {
            startColumns[i] = getFirstNonBlankColumn(lines[i], 1);
            endColumns[i] = getLastNonBlankColumn(lines[i], 1);
        }
        this.lines = lines;
        this._startColumns = startColumns;
        this._endColumns = endColumns;
    }
    getElements() {
        const elements = [];
        for (let i = 0, len = this.lines.length; i < len; i++) {
            elements[i] = this.lines[i].substring(this._startColumns[i] - 1, this._endColumns[i] - 1);
        }
        return elements;
    }
    getStrictElement(index) {
        return this.lines[index];
    }
    getStartLineNumber(i) {
        return i + 1;
    }
    getEndLineNumber(i) {
        return i + 1;
    }
    createCharSequence(shouldIgnoreTrimWhitespace, startIndex, endIndex) {
        const charCodes = [];
        const lineNumbers = [];
        const columns = [];
        let len = 0;
        for (let index = startIndex; index <= endIndex; index++) {
            const lineContent = this.lines[index];
            const startColumn = (shouldIgnoreTrimWhitespace ? this._startColumns[index] : 1);
            const endColumn = (shouldIgnoreTrimWhitespace ? this._endColumns[index] : lineContent.length + 1);
            for (let col = startColumn; col < endColumn; col++) {
                charCodes[len] = lineContent.charCodeAt(col - 1);
                lineNumbers[len] = index + 1;
                columns[len] = col;
                len++;
            }
            if (!shouldIgnoreTrimWhitespace && index < endIndex) {
                // Add \n if trim whitespace is not ignored
                charCodes[len] = 10 /* CharCode.LineFeed */;
                lineNumbers[len] = index + 1;
                columns[len] = lineContent.length + 1;
                len++;
            }
        }
        return new CharSequence(charCodes, lineNumbers, columns);
    }
};
class CharSequence {
    constructor(charCodes, lineNumbers, columns) {
        this._charCodes = charCodes;
        this._lineNumbers = lineNumbers;
        this._columns = columns;
    }
    toString() {
        return ('[' + this._charCodes.map((s, idx) => (s === 10 /* CharCode.LineFeed */ ? '\\n' : String.fromCharCode(s)) + `-(${this._lineNumbers[idx]},${this._columns[idx]})`).join(', ') + ']');
    }
    _assertIndex(index, arr) {
        if (index < 0 || index >= arr.length) {
            throw new Error(`Illegal index`);
        }
    }
    getElements() {
        return this._charCodes;
    }
    getStartLineNumber(i) {
        if (i > 0 && i === this._lineNumbers.length) {
            // the start line number of the element after the last element
            // is the end line number of the last element
            return this.getEndLineNumber(i - 1);
        }
        this._assertIndex(i, this._lineNumbers);
        return this._lineNumbers[i];
    }
    getEndLineNumber(i) {
        if (i === -1) {
            // the end line number of the element before the first element
            // is the start line number of the first element
            return this.getStartLineNumber(i + 1);
        }
        this._assertIndex(i, this._lineNumbers);
        if (this._charCodes[i] === 10 /* CharCode.LineFeed */) {
            return this._lineNumbers[i] + 1;
        }
        return this._lineNumbers[i];
    }
    getStartColumn(i) {
        if (i > 0 && i === this._columns.length) {
            // the start column of the element after the last element
            // is the end column of the last element
            return this.getEndColumn(i - 1);
        }
        this._assertIndex(i, this._columns);
        return this._columns[i];
    }
    getEndColumn(i) {
        if (i === -1) {
            // the end column of the element before the first element
            // is the start column of the first element
            return this.getStartColumn(i + 1);
        }
        this._assertIndex(i, this._columns);
        if (this._charCodes[i] === 10 /* CharCode.LineFeed */) {
            return 1;
        }
        return this._columns[i] + 1;
    }
}
class CharChange {
    constructor(originalStartLineNumber, originalStartColumn, originalEndLineNumber, originalEndColumn, modifiedStartLineNumber, modifiedStartColumn, modifiedEndLineNumber, modifiedEndColumn) {
        this.originalStartLineNumber = originalStartLineNumber;
        this.originalStartColumn = originalStartColumn;
        this.originalEndLineNumber = originalEndLineNumber;
        this.originalEndColumn = originalEndColumn;
        this.modifiedStartLineNumber = modifiedStartLineNumber;
        this.modifiedStartColumn = modifiedStartColumn;
        this.modifiedEndLineNumber = modifiedEndLineNumber;
        this.modifiedEndColumn = modifiedEndColumn;
    }
    static createFromDiffChange(diffChange, originalCharSequence, modifiedCharSequence) {
        const originalStartLineNumber = originalCharSequence.getStartLineNumber(diffChange.originalStart);
        const originalStartColumn = originalCharSequence.getStartColumn(diffChange.originalStart);
        const originalEndLineNumber = originalCharSequence.getEndLineNumber(diffChange.originalStart + diffChange.originalLength - 1);
        const originalEndColumn = originalCharSequence.getEndColumn(diffChange.originalStart + diffChange.originalLength - 1);
        const modifiedStartLineNumber = modifiedCharSequence.getStartLineNumber(diffChange.modifiedStart);
        const modifiedStartColumn = modifiedCharSequence.getStartColumn(diffChange.modifiedStart);
        const modifiedEndLineNumber = modifiedCharSequence.getEndLineNumber(diffChange.modifiedStart + diffChange.modifiedLength - 1);
        const modifiedEndColumn = modifiedCharSequence.getEndColumn(diffChange.modifiedStart + diffChange.modifiedLength - 1);
        return new CharChange(originalStartLineNumber, originalStartColumn, originalEndLineNumber, originalEndColumn, modifiedStartLineNumber, modifiedStartColumn, modifiedEndLineNumber, modifiedEndColumn);
    }
}
function postProcessCharChanges(rawChanges) {
    if (rawChanges.length <= 1) {
        return rawChanges;
    }
    const result = [rawChanges[0]];
    let prevChange = result[0];
    for (let i = 1, len = rawChanges.length; i < len; i++) {
        const currChange = rawChanges[i];
        const originalMatchingLength = currChange.originalStart - (prevChange.originalStart + prevChange.originalLength);
        const modifiedMatchingLength = currChange.modifiedStart - (prevChange.modifiedStart + prevChange.modifiedLength);
        // Both of the above should be equal, but the continueProcessingPredicate may prevent this from being true
        const matchingLength = Math.min(originalMatchingLength, modifiedMatchingLength);
        if (matchingLength < MINIMUM_MATCHING_CHARACTER_LENGTH) {
            // Merge the current change into the previous one
            prevChange.originalLength = (currChange.originalStart + currChange.originalLength) - prevChange.originalStart;
            prevChange.modifiedLength = (currChange.modifiedStart + currChange.modifiedLength) - prevChange.modifiedStart;
        }
        else {
            // Add the current change
            result.push(currChange);
            prevChange = currChange;
        }
    }
    return result;
}
class LineChange {
    constructor(originalStartLineNumber, originalEndLineNumber, modifiedStartLineNumber, modifiedEndLineNumber, charChanges) {
        this.originalStartLineNumber = originalStartLineNumber;
        this.originalEndLineNumber = originalEndLineNumber;
        this.modifiedStartLineNumber = modifiedStartLineNumber;
        this.modifiedEndLineNumber = modifiedEndLineNumber;
        this.charChanges = charChanges;
    }
    static createFromDiffResult(shouldIgnoreTrimWhitespace, diffChange, originalLineSequence, modifiedLineSequence, continueCharDiff, shouldComputeCharChanges, shouldPostProcessCharChanges) {
        let originalStartLineNumber;
        let originalEndLineNumber;
        let modifiedStartLineNumber;
        let modifiedEndLineNumber;
        let charChanges = undefined;
        if (diffChange.originalLength === 0) {
            originalStartLineNumber = originalLineSequence.getStartLineNumber(diffChange.originalStart) - 1;
            originalEndLineNumber = 0;
        }
        else {
            originalStartLineNumber = originalLineSequence.getStartLineNumber(diffChange.originalStart);
            originalEndLineNumber = originalLineSequence.getEndLineNumber(diffChange.originalStart + diffChange.originalLength - 1);
        }
        if (diffChange.modifiedLength === 0) {
            modifiedStartLineNumber = modifiedLineSequence.getStartLineNumber(diffChange.modifiedStart) - 1;
            modifiedEndLineNumber = 0;
        }
        else {
            modifiedStartLineNumber = modifiedLineSequence.getStartLineNumber(diffChange.modifiedStart);
            modifiedEndLineNumber = modifiedLineSequence.getEndLineNumber(diffChange.modifiedStart + diffChange.modifiedLength - 1);
        }
        if (shouldComputeCharChanges && diffChange.originalLength > 0 && diffChange.originalLength < 20 && diffChange.modifiedLength > 0 && diffChange.modifiedLength < 20 && continueCharDiff()) {
            // Compute character changes for diff chunks of at most 20 lines...
            const originalCharSequence = originalLineSequence.createCharSequence(shouldIgnoreTrimWhitespace, diffChange.originalStart, diffChange.originalStart + diffChange.originalLength - 1);
            const modifiedCharSequence = modifiedLineSequence.createCharSequence(shouldIgnoreTrimWhitespace, diffChange.modifiedStart, diffChange.modifiedStart + diffChange.modifiedLength - 1);
            if (originalCharSequence.getElements().length > 0 && modifiedCharSequence.getElements().length > 0) {
                let rawChanges = computeDiff(originalCharSequence, modifiedCharSequence, continueCharDiff, true).changes;
                if (shouldPostProcessCharChanges) {
                    rawChanges = postProcessCharChanges(rawChanges);
                }
                charChanges = [];
                for (let i = 0, length = rawChanges.length; i < length; i++) {
                    charChanges.push(CharChange.createFromDiffChange(rawChanges[i], originalCharSequence, modifiedCharSequence));
                }
            }
        }
        return new LineChange(originalStartLineNumber, originalEndLineNumber, modifiedStartLineNumber, modifiedEndLineNumber, charChanges);
    }
}
class DiffComputer {
    constructor(originalLines, modifiedLines, opts) {
        this.shouldComputeCharChanges = opts.shouldComputeCharChanges;
        this.shouldPostProcessCharChanges = opts.shouldPostProcessCharChanges;
        this.shouldIgnoreTrimWhitespace = opts.shouldIgnoreTrimWhitespace;
        this.shouldMakePrettyDiff = opts.shouldMakePrettyDiff;
        this.originalLines = originalLines;
        this.modifiedLines = modifiedLines;
        this.original = new LineSequence$1(originalLines);
        this.modified = new LineSequence$1(modifiedLines);
        this.continueLineDiff = createContinueProcessingPredicate(opts.maxComputationTime);
        this.continueCharDiff = createContinueProcessingPredicate(opts.maxComputationTime === 0 ? 0 : Math.min(opts.maxComputationTime, 5000)); // never run after 5s for character changes...
    }
    computeDiff() {
        if (this.original.lines.length === 1 && this.original.lines[0].length === 0) {
            // empty original => fast path
            if (this.modified.lines.length === 1 && this.modified.lines[0].length === 0) {
                return {
                    quitEarly: false,
                    changes: []
                };
            }
            return {
                quitEarly: false,
                changes: [{
                        originalStartLineNumber: 1,
                        originalEndLineNumber: 1,
                        modifiedStartLineNumber: 1,
                        modifiedEndLineNumber: this.modified.lines.length,
                        charChanges: undefined
                    }]
            };
        }
        if (this.modified.lines.length === 1 && this.modified.lines[0].length === 0) {
            // empty modified => fast path
            return {
                quitEarly: false,
                changes: [{
                        originalStartLineNumber: 1,
                        originalEndLineNumber: this.original.lines.length,
                        modifiedStartLineNumber: 1,
                        modifiedEndLineNumber: 1,
                        charChanges: undefined
                    }]
            };
        }
        const diffResult = computeDiff(this.original, this.modified, this.continueLineDiff, this.shouldMakePrettyDiff);
        const rawChanges = diffResult.changes;
        const quitEarly = diffResult.quitEarly;
        // The diff is always computed with ignoring trim whitespace
        // This ensures we get the prettiest diff
        if (this.shouldIgnoreTrimWhitespace) {
            const lineChanges = [];
            for (let i = 0, length = rawChanges.length; i < length; i++) {
                lineChanges.push(LineChange.createFromDiffResult(this.shouldIgnoreTrimWhitespace, rawChanges[i], this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges));
            }
            return {
                quitEarly: quitEarly,
                changes: lineChanges
            };
        }
        // Need to post-process and introduce changes where the trim whitespace is different
        // Note that we are looping starting at -1 to also cover the lines before the first change
        const result = [];
        let originalLineIndex = 0;
        let modifiedLineIndex = 0;
        for (let i = -1 /* !!!! */, len = rawChanges.length; i < len; i++) {
            const nextChange = (i + 1 < len ? rawChanges[i + 1] : null);
            const originalStop = (nextChange ? nextChange.originalStart : this.originalLines.length);
            const modifiedStop = (nextChange ? nextChange.modifiedStart : this.modifiedLines.length);
            while (originalLineIndex < originalStop && modifiedLineIndex < modifiedStop) {
                const originalLine = this.originalLines[originalLineIndex];
                const modifiedLine = this.modifiedLines[modifiedLineIndex];
                if (originalLine !== modifiedLine) {
                    // These lines differ only in trim whitespace
                    // Check the leading whitespace
                    {
                        let originalStartColumn = getFirstNonBlankColumn(originalLine, 1);
                        let modifiedStartColumn = getFirstNonBlankColumn(modifiedLine, 1);
                        while (originalStartColumn > 1 && modifiedStartColumn > 1) {
                            const originalChar = originalLine.charCodeAt(originalStartColumn - 2);
                            const modifiedChar = modifiedLine.charCodeAt(modifiedStartColumn - 2);
                            if (originalChar !== modifiedChar) {
                                break;
                            }
                            originalStartColumn--;
                            modifiedStartColumn--;
                        }
                        if (originalStartColumn > 1 || modifiedStartColumn > 1) {
                            this._pushTrimWhitespaceCharChange(result, originalLineIndex + 1, 1, originalStartColumn, modifiedLineIndex + 1, 1, modifiedStartColumn);
                        }
                    }
                    // Check the trailing whitespace
                    {
                        let originalEndColumn = getLastNonBlankColumn(originalLine, 1);
                        let modifiedEndColumn = getLastNonBlankColumn(modifiedLine, 1);
                        const originalMaxColumn = originalLine.length + 1;
                        const modifiedMaxColumn = modifiedLine.length + 1;
                        while (originalEndColumn < originalMaxColumn && modifiedEndColumn < modifiedMaxColumn) {
                            const originalChar = originalLine.charCodeAt(originalEndColumn - 1);
                            const modifiedChar = originalLine.charCodeAt(modifiedEndColumn - 1);
                            if (originalChar !== modifiedChar) {
                                break;
                            }
                            originalEndColumn++;
                            modifiedEndColumn++;
                        }
                        if (originalEndColumn < originalMaxColumn || modifiedEndColumn < modifiedMaxColumn) {
                            this._pushTrimWhitespaceCharChange(result, originalLineIndex + 1, originalEndColumn, originalMaxColumn, modifiedLineIndex + 1, modifiedEndColumn, modifiedMaxColumn);
                        }
                    }
                }
                originalLineIndex++;
                modifiedLineIndex++;
            }
            if (nextChange) {
                // Emit the actual change
                result.push(LineChange.createFromDiffResult(this.shouldIgnoreTrimWhitespace, nextChange, this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges));
                originalLineIndex += nextChange.originalLength;
                modifiedLineIndex += nextChange.modifiedLength;
            }
        }
        return {
            quitEarly: quitEarly,
            changes: result
        };
    }
    _pushTrimWhitespaceCharChange(result, originalLineNumber, originalStartColumn, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedEndColumn) {
        if (this._mergeTrimWhitespaceCharChange(result, originalLineNumber, originalStartColumn, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedEndColumn)) {
            // Merged into previous
            return;
        }
        let charChanges = undefined;
        if (this.shouldComputeCharChanges) {
            charChanges = [new CharChange(originalLineNumber, originalStartColumn, originalLineNumber, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedLineNumber, modifiedEndColumn)];
        }
        result.push(new LineChange(originalLineNumber, originalLineNumber, modifiedLineNumber, modifiedLineNumber, charChanges));
    }
    _mergeTrimWhitespaceCharChange(result, originalLineNumber, originalStartColumn, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedEndColumn) {
        const len = result.length;
        if (len === 0) {
            return false;
        }
        const prevChange = result[len - 1];
        if (prevChange.originalEndLineNumber === 0 || prevChange.modifiedEndLineNumber === 0) {
            // Don't merge with inserts/deletes
            return false;
        }
        if (prevChange.originalEndLineNumber === originalLineNumber && prevChange.modifiedEndLineNumber === modifiedLineNumber) {
            if (this.shouldComputeCharChanges && prevChange.charChanges) {
                prevChange.charChanges.push(new CharChange(originalLineNumber, originalStartColumn, originalLineNumber, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedLineNumber, modifiedEndColumn));
            }
            return true;
        }
        if (prevChange.originalEndLineNumber + 1 === originalLineNumber && prevChange.modifiedEndLineNumber + 1 === modifiedLineNumber) {
            prevChange.originalEndLineNumber = originalLineNumber;
            prevChange.modifiedEndLineNumber = modifiedLineNumber;
            if (this.shouldComputeCharChanges && prevChange.charChanges) {
                prevChange.charChanges.push(new CharChange(originalLineNumber, originalStartColumn, originalLineNumber, originalEndColumn, modifiedLineNumber, modifiedStartColumn, modifiedLineNumber, modifiedEndColumn));
            }
            return true;
        }
        return false;
    }
}
function getFirstNonBlankColumn(txt, defaultValue) {
    const r = firstNonWhitespaceIndex(txt);
    if (r === -1) {
        return defaultValue;
    }
    return r + 1;
}
function getLastNonBlankColumn(txt, defaultValue) {
    const r = lastNonWhitespaceIndex(txt);
    if (r === -1) {
        return defaultValue;
    }
    return r + 2;
}
function createContinueProcessingPredicate(maximumRuntime) {
    if (maximumRuntime === 0) {
        return () => true;
    }
    const startTime = Date.now();
    return () => {
        return Date.now() - startTime < maximumRuntime;
    };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class DiffAlgorithmResult {
    static trivial(seq1, seq2) {
        return new DiffAlgorithmResult([new SequenceDiff(OffsetRange.ofLength(seq1.length), OffsetRange.ofLength(seq2.length))], false);
    }
    static trivialTimedOut(seq1, seq2) {
        return new DiffAlgorithmResult([new SequenceDiff(OffsetRange.ofLength(seq1.length), OffsetRange.ofLength(seq2.length))], true);
    }
    constructor(diffs, 
    /**
     * Indicates if the time out was reached.
     * In that case, the diffs might be an approximation and the user should be asked to rerun the diff with more time.
     */
    hitTimeout) {
        this.diffs = diffs;
        this.hitTimeout = hitTimeout;
    }
}
class SequenceDiff {
    static invert(sequenceDiffs, doc1Length) {
        const result = [];
        forEachAdjacent(sequenceDiffs, (a, b) => {
            result.push(SequenceDiff.fromOffsetPairs(a ? a.getEndExclusives() : OffsetPair.zero, b ? b.getStarts() : new OffsetPair(doc1Length, (a ? a.seq2Range.endExclusive - a.seq1Range.endExclusive : 0) + doc1Length)));
        });
        return result;
    }
    static fromOffsetPairs(start, endExclusive) {
        return new SequenceDiff(new OffsetRange(start.offset1, endExclusive.offset1), new OffsetRange(start.offset2, endExclusive.offset2));
    }
    constructor(seq1Range, seq2Range) {
        this.seq1Range = seq1Range;
        this.seq2Range = seq2Range;
    }
    swap() {
        return new SequenceDiff(this.seq2Range, this.seq1Range);
    }
    toString() {
        return `${this.seq1Range} <-> ${this.seq2Range}`;
    }
    join(other) {
        return new SequenceDiff(this.seq1Range.join(other.seq1Range), this.seq2Range.join(other.seq2Range));
    }
    delta(offset) {
        if (offset === 0) {
            return this;
        }
        return new SequenceDiff(this.seq1Range.delta(offset), this.seq2Range.delta(offset));
    }
    deltaStart(offset) {
        if (offset === 0) {
            return this;
        }
        return new SequenceDiff(this.seq1Range.deltaStart(offset), this.seq2Range.deltaStart(offset));
    }
    deltaEnd(offset) {
        if (offset === 0) {
            return this;
        }
        return new SequenceDiff(this.seq1Range.deltaEnd(offset), this.seq2Range.deltaEnd(offset));
    }
    intersect(other) {
        const i1 = this.seq1Range.intersect(other.seq1Range);
        const i2 = this.seq2Range.intersect(other.seq2Range);
        if (!i1 || !i2) {
            return undefined;
        }
        return new SequenceDiff(i1, i2);
    }
    getStarts() {
        return new OffsetPair(this.seq1Range.start, this.seq2Range.start);
    }
    getEndExclusives() {
        return new OffsetPair(this.seq1Range.endExclusive, this.seq2Range.endExclusive);
    }
}
class OffsetPair {
    constructor(offset1, offset2) {
        this.offset1 = offset1;
        this.offset2 = offset2;
    }
    toString() {
        return `${this.offset1} <-> ${this.offset2}`;
    }
    delta(offset) {
        if (offset === 0) {
            return this;
        }
        return new OffsetPair(this.offset1 + offset, this.offset2 + offset);
    }
    equals(other) {
        return this.offset1 === other.offset1 && this.offset2 === other.offset2;
    }
}
OffsetPair.zero = new OffsetPair(0, 0);
OffsetPair.max = new OffsetPair(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
class InfiniteTimeout {
    isValid() {
        return true;
    }
}
InfiniteTimeout.instance = new InfiniteTimeout();
class DateTimeout {
    constructor(timeout) {
        this.timeout = timeout;
        this.startTime = Date.now();
        this.valid = true;
        if (timeout <= 0) {
            throw new BugIndicatingError('timeout must be positive');
        }
    }
    // Recommendation: Set a log-point `{this.disable()}` in the body
    isValid() {
        const valid = Date.now() - this.startTime < this.timeout;
        if (!valid && this.valid) {
            this.valid = false; // timeout reached
            // eslint-disable-next-line no-debugger
            debugger; // WARNING: Most likely debugging caused the timeout. Call `this.disable()` to continue without timing out.
        }
        return this.valid;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class Array2D {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.array = [];
        this.array = new Array(width * height);
    }
    get(x, y) {
        return this.array[x + y * this.width];
    }
    set(x, y, value) {
        this.array[x + y * this.width] = value;
    }
}
function isSpace(charCode) {
    return charCode === 32 /* CharCode.Space */ || charCode === 9 /* CharCode.Tab */;
}
class LineRangeFragment {
    static getKey(chr) {
        let key = this.chrKeys.get(chr);
        if (key === undefined) {
            key = this.chrKeys.size;
            this.chrKeys.set(chr, key);
        }
        return key;
    }
    constructor(range, lines, source) {
        this.range = range;
        this.lines = lines;
        this.source = source;
        this.histogram = [];
        let counter = 0;
        for (let i = range.startLineNumber - 1; i < range.endLineNumberExclusive - 1; i++) {
            const line = lines[i];
            for (let j = 0; j < line.length; j++) {
                counter++;
                const chr = line[j];
                const key = LineRangeFragment.getKey(chr);
                this.histogram[key] = (this.histogram[key] || 0) + 1;
            }
            counter++;
            const key = LineRangeFragment.getKey('\n');
            this.histogram[key] = (this.histogram[key] || 0) + 1;
        }
        this.totalCount = counter;
    }
    computeSimilarity(other) {
        var _a, _b;
        let sumDifferences = 0;
        const maxLength = Math.max(this.histogram.length, other.histogram.length);
        for (let i = 0; i < maxLength; i++) {
            sumDifferences += Math.abs(((_a = this.histogram[i]) !== null && _a !== void 0 ? _a : 0) - ((_b = other.histogram[i]) !== null && _b !== void 0 ? _b : 0));
        }
        return 1 - (sumDifferences / (this.totalCount + other.totalCount));
    }
}
LineRangeFragment.chrKeys = new Map();

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * A O(MN) diffing algorithm that supports a score function.
 * The algorithm can be improved by processing the 2d array diagonally.
*/
class DynamicProgrammingDiffing {
    compute(sequence1, sequence2, timeout = InfiniteTimeout.instance, equalityScore) {
        if (sequence1.length === 0 || sequence2.length === 0) {
            return DiffAlgorithmResult.trivial(sequence1, sequence2);
        }
        /**
         * lcsLengths.get(i, j): Length of the longest common subsequence of sequence1.substring(0, i + 1) and sequence2.substring(0, j + 1).
         */
        const lcsLengths = new Array2D(sequence1.length, sequence2.length);
        const directions = new Array2D(sequence1.length, sequence2.length);
        const lengths = new Array2D(sequence1.length, sequence2.length);
        // ==== Initializing lcsLengths ====
        for (let s1 = 0; s1 < sequence1.length; s1++) {
            for (let s2 = 0; s2 < sequence2.length; s2++) {
                if (!timeout.isValid()) {
                    return DiffAlgorithmResult.trivialTimedOut(sequence1, sequence2);
                }
                const horizontalLen = s1 === 0 ? 0 : lcsLengths.get(s1 - 1, s2);
                const verticalLen = s2 === 0 ? 0 : lcsLengths.get(s1, s2 - 1);
                let extendedSeqScore;
                if (sequence1.getElement(s1) === sequence2.getElement(s2)) {
                    if (s1 === 0 || s2 === 0) {
                        extendedSeqScore = 0;
                    }
                    else {
                        extendedSeqScore = lcsLengths.get(s1 - 1, s2 - 1);
                    }
                    if (s1 > 0 && s2 > 0 && directions.get(s1 - 1, s2 - 1) === 3) {
                        // Prefer consecutive diagonals
                        extendedSeqScore += lengths.get(s1 - 1, s2 - 1);
                    }
                    extendedSeqScore += (equalityScore ? equalityScore(s1, s2) : 1);
                }
                else {
                    extendedSeqScore = -1;
                }
                const newValue = Math.max(horizontalLen, verticalLen, extendedSeqScore);
                if (newValue === extendedSeqScore) {
                    // Prefer diagonals
                    const prevLen = s1 > 0 && s2 > 0 ? lengths.get(s1 - 1, s2 - 1) : 0;
                    lengths.set(s1, s2, prevLen + 1);
                    directions.set(s1, s2, 3);
                }
                else if (newValue === horizontalLen) {
                    lengths.set(s1, s2, 0);
                    directions.set(s1, s2, 1);
                }
                else if (newValue === verticalLen) {
                    lengths.set(s1, s2, 0);
                    directions.set(s1, s2, 2);
                }
                lcsLengths.set(s1, s2, newValue);
            }
        }
        // ==== Backtracking ====
        const result = [];
        let lastAligningPosS1 = sequence1.length;
        let lastAligningPosS2 = sequence2.length;
        function reportDecreasingAligningPositions(s1, s2) {
            if (s1 + 1 !== lastAligningPosS1 || s2 + 1 !== lastAligningPosS2) {
                result.push(new SequenceDiff(new OffsetRange(s1 + 1, lastAligningPosS1), new OffsetRange(s2 + 1, lastAligningPosS2)));
            }
            lastAligningPosS1 = s1;
            lastAligningPosS2 = s2;
        }
        let s1 = sequence1.length - 1;
        let s2 = sequence2.length - 1;
        while (s1 >= 0 && s2 >= 0) {
            if (directions.get(s1, s2) === 3) {
                reportDecreasingAligningPositions(s1, s2);
                s1--;
                s2--;
            }
            else {
                if (directions.get(s1, s2) === 1) {
                    s1--;
                }
                else {
                    s2--;
                }
            }
        }
        reportDecreasingAligningPositions(-1, -1);
        result.reverse();
        return new DiffAlgorithmResult(result, false);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * An O(ND) diff algorithm that has a quadratic space worst-case complexity.
*/
class MyersDiffAlgorithm {
    compute(seq1, seq2, timeout = InfiniteTimeout.instance) {
        // These are common special cases.
        // The early return improves performance dramatically.
        if (seq1.length === 0 || seq2.length === 0) {
            return DiffAlgorithmResult.trivial(seq1, seq2);
        }
        const seqX = seq1; // Text on the x axis
        const seqY = seq2; // Text on the y axis
        function getXAfterSnake(x, y) {
            while (x < seqX.length && y < seqY.length && seqX.getElement(x) === seqY.getElement(y)) {
                x++;
                y++;
            }
            return x;
        }
        let d = 0;
        // V[k]: X value of longest d-line that ends in diagonal k.
        // d-line: path from (0,0) to (x,y) that uses exactly d non-diagonals.
        // diagonal k: Set of points (x,y) with x-y = k.
        // k=1 -> (1,0),(2,1)
        const V = new FastInt32Array();
        V.set(0, getXAfterSnake(0, 0));
        const paths = new FastArrayNegativeIndices();
        paths.set(0, V.get(0) === 0 ? null : new SnakePath(null, 0, 0, V.get(0)));
        let k = 0;
        loop: while (true) {
            d++;
            if (!timeout.isValid()) {
                return DiffAlgorithmResult.trivialTimedOut(seqX, seqY);
            }
            // The paper has `for (k = -d; k <= d; k += 2)`, but we can ignore diagonals that cannot influence the result.
            const lowerBound = -Math.min(d, seqY.length + (d % 2));
            const upperBound = Math.min(d, seqX.length + (d % 2));
            for (k = lowerBound; k <= upperBound; k += 2) {
                // We can use the X values of (d-1)-lines to compute X value of the longest d-lines.
                const maxXofDLineTop = k === upperBound ? -1 : V.get(k + 1); // We take a vertical non-diagonal (add a symbol in seqX)
                const maxXofDLineLeft = k === lowerBound ? -1 : V.get(k - 1) + 1; // We take a horizontal non-diagonal (+1 x) (delete a symbol in seqX)
                const x = Math.min(Math.max(maxXofDLineTop, maxXofDLineLeft), seqX.length);
                const y = x - k;
                if (x > seqX.length || y > seqY.length) {
                    // This diagonal is irrelevant for the result.
                    // TODO: Don't pay the cost for this in the next iteration.
                    continue;
                }
                const newMaxX = getXAfterSnake(x, y);
                V.set(k, newMaxX);
                const lastPath = x === maxXofDLineTop ? paths.get(k + 1) : paths.get(k - 1);
                paths.set(k, newMaxX !== x ? new SnakePath(lastPath, x, y, newMaxX - x) : lastPath);
                if (V.get(k) === seqX.length && V.get(k) - k === seqY.length) {
                    break loop;
                }
            }
        }
        let path = paths.get(k);
        const result = [];
        let lastAligningPosS1 = seqX.length;
        let lastAligningPosS2 = seqY.length;
        while (true) {
            const endX = path ? path.x + path.length : 0;
            const endY = path ? path.y + path.length : 0;
            if (endX !== lastAligningPosS1 || endY !== lastAligningPosS2) {
                result.push(new SequenceDiff(new OffsetRange(endX, lastAligningPosS1), new OffsetRange(endY, lastAligningPosS2)));
            }
            if (!path) {
                break;
            }
            lastAligningPosS1 = path.x;
            lastAligningPosS2 = path.y;
            path = path.prev;
        }
        result.reverse();
        return new DiffAlgorithmResult(result, false);
    }
}
class SnakePath {
    constructor(prev, x, y, length) {
        this.prev = prev;
        this.x = x;
        this.y = y;
        this.length = length;
    }
}
/**
 * An array that supports fast negative indices.
*/
class FastInt32Array {
    constructor() {
        this.positiveArr = new Int32Array(10);
        this.negativeArr = new Int32Array(10);
    }
    get(idx) {
        if (idx < 0) {
            idx = -idx - 1;
            return this.negativeArr[idx];
        }
        else {
            return this.positiveArr[idx];
        }
    }
    set(idx, value) {
        if (idx < 0) {
            idx = -idx - 1;
            if (idx >= this.negativeArr.length) {
                const arr = this.negativeArr;
                this.negativeArr = new Int32Array(arr.length * 2);
                this.negativeArr.set(arr);
            }
            this.negativeArr[idx] = value;
        }
        else {
            if (idx >= this.positiveArr.length) {
                const arr = this.positiveArr;
                this.positiveArr = new Int32Array(arr.length * 2);
                this.positiveArr.set(arr);
            }
            this.positiveArr[idx] = value;
        }
    }
}
/**
 * An array that supports fast negative indices.
*/
class FastArrayNegativeIndices {
    constructor() {
        this.positiveArr = [];
        this.negativeArr = [];
    }
    get(idx) {
        if (idx < 0) {
            idx = -idx - 1;
            return this.negativeArr[idx];
        }
        else {
            return this.positiveArr[idx];
        }
    }
    set(idx, value) {
        if (idx < 0) {
            idx = -idx - 1;
            this.negativeArr[idx] = value;
        }
        else {
            this.positiveArr[idx] = value;
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class LinesSliceCharSequence {
    constructor(lines, lineRange, considerWhitespaceChanges) {
        // This slice has to have lineRange.length many \n! (otherwise diffing against an empty slice will be problematic)
        // (Unless it covers the entire document, in that case the other slice also has to cover the entire document ands it's okay)
        this.lines = lines;
        this.considerWhitespaceChanges = considerWhitespaceChanges;
        this.elements = [];
        this.firstCharOffsetByLine = [];
        // To account for trimming
        this.additionalOffsetByLine = [];
        // If the slice covers the end, but does not start at the beginning, we include just the \n of the previous line.
        let trimFirstLineFully = false;
        if (lineRange.start > 0 && lineRange.endExclusive >= lines.length) {
            lineRange = new OffsetRange(lineRange.start - 1, lineRange.endExclusive);
            trimFirstLineFully = true;
        }
        this.lineRange = lineRange;
        this.firstCharOffsetByLine[0] = 0;
        for (let i = this.lineRange.start; i < this.lineRange.endExclusive; i++) {
            let line = lines[i];
            let offset = 0;
            if (trimFirstLineFully) {
                offset = line.length;
                line = '';
                trimFirstLineFully = false;
            }
            else if (!considerWhitespaceChanges) {
                const trimmedStartLine = line.trimStart();
                offset = line.length - trimmedStartLine.length;
                line = trimmedStartLine.trimEnd();
            }
            this.additionalOffsetByLine.push(offset);
            for (let i = 0; i < line.length; i++) {
                this.elements.push(line.charCodeAt(i));
            }
            // Don't add an \n that does not exist in the document.
            if (i < lines.length - 1) {
                this.elements.push('\n'.charCodeAt(0));
                this.firstCharOffsetByLine[i - this.lineRange.start + 1] = this.elements.length;
            }
        }
        // To account for the last line
        this.additionalOffsetByLine.push(0);
    }
    toString() {
        return `Slice: "${this.text}"`;
    }
    get text() {
        return this.getText(new OffsetRange(0, this.length));
    }
    getText(range) {
        return this.elements.slice(range.start, range.endExclusive).map(e => String.fromCharCode(e)).join('');
    }
    getElement(offset) {
        return this.elements[offset];
    }
    get length() {
        return this.elements.length;
    }
    getBoundaryScore(length) {
        //   a   b   c   ,           d   e   f
        // 11  0   0   12  15  6   13  0   0   11
        const prevCategory = getCategory(length > 0 ? this.elements[length - 1] : -1);
        const nextCategory = getCategory(length < this.elements.length ? this.elements[length] : -1);
        if (prevCategory === 7 /* CharBoundaryCategory.LineBreakCR */ && nextCategory === 8 /* CharBoundaryCategory.LineBreakLF */) {
            // don't break between \r and \n
            return 0;
        }
        if (prevCategory === 8 /* CharBoundaryCategory.LineBreakLF */) {
            // prefer the linebreak before the change
            return 150;
        }
        let score = 0;
        if (prevCategory !== nextCategory) {
            score += 10;
            if (prevCategory === 0 /* CharBoundaryCategory.WordLower */ && nextCategory === 1 /* CharBoundaryCategory.WordUpper */) {
                score += 1;
            }
        }
        score += getCategoryBoundaryScore(prevCategory);
        score += getCategoryBoundaryScore(nextCategory);
        return score;
    }
    translateOffset(offset) {
        // find smallest i, so that lineBreakOffsets[i] <= offset using binary search
        if (this.lineRange.isEmpty) {
            return new Position(this.lineRange.start + 1, 1);
        }
        const i = findLastIdxMonotonous(this.firstCharOffsetByLine, (value) => value <= offset);
        return new Position(this.lineRange.start + i + 1, offset - this.firstCharOffsetByLine[i] + this.additionalOffsetByLine[i] + 1);
    }
    translateRange(range) {
        return Range.fromPositions(this.translateOffset(range.start), this.translateOffset(range.endExclusive));
    }
    /**
     * Finds the word that contains the character at the given offset
     */
    findWordContaining(offset) {
        if (offset < 0 || offset >= this.elements.length) {
            return undefined;
        }
        if (!isWordChar(this.elements[offset])) {
            return undefined;
        }
        // find start
        let start = offset;
        while (start > 0 && isWordChar(this.elements[start - 1])) {
            start--;
        }
        // find end
        let end = offset;
        while (end < this.elements.length && isWordChar(this.elements[end])) {
            end++;
        }
        return new OffsetRange(start, end);
    }
    countLinesIn(range) {
        return this.translateOffset(range.endExclusive).lineNumber - this.translateOffset(range.start).lineNumber;
    }
    isStronglyEqual(offset1, offset2) {
        return this.elements[offset1] === this.elements[offset2];
    }
    extendToFullLines(range) {
        var _a, _b;
        const start = (_a = findLastMonotonous(this.firstCharOffsetByLine, x => x <= range.start)) !== null && _a !== void 0 ? _a : 0;
        const end = (_b = findFirstMonotonous(this.firstCharOffsetByLine, x => range.endExclusive <= x)) !== null && _b !== void 0 ? _b : this.elements.length;
        return new OffsetRange(start, end);
    }
}
function isWordChar(charCode) {
    return charCode >= 97 /* CharCode.a */ && charCode <= 122 /* CharCode.z */
        || charCode >= 65 /* CharCode.A */ && charCode <= 90 /* CharCode.Z */
        || charCode >= 48 /* CharCode.Digit0 */ && charCode <= 57 /* CharCode.Digit9 */;
}
const score = {
    [0 /* CharBoundaryCategory.WordLower */]: 0,
    [1 /* CharBoundaryCategory.WordUpper */]: 0,
    [2 /* CharBoundaryCategory.WordNumber */]: 0,
    [3 /* CharBoundaryCategory.End */]: 10,
    [4 /* CharBoundaryCategory.Other */]: 2,
    [5 /* CharBoundaryCategory.Separator */]: 30,
    [6 /* CharBoundaryCategory.Space */]: 3,
    [7 /* CharBoundaryCategory.LineBreakCR */]: 10,
    [8 /* CharBoundaryCategory.LineBreakLF */]: 10,
};
function getCategoryBoundaryScore(category) {
    return score[category];
}
function getCategory(charCode) {
    if (charCode === 10 /* CharCode.LineFeed */) {
        return 8 /* CharBoundaryCategory.LineBreakLF */;
    }
    else if (charCode === 13 /* CharCode.CarriageReturn */) {
        return 7 /* CharBoundaryCategory.LineBreakCR */;
    }
    else if (isSpace(charCode)) {
        return 6 /* CharBoundaryCategory.Space */;
    }
    else if (charCode >= 97 /* CharCode.a */ && charCode <= 122 /* CharCode.z */) {
        return 0 /* CharBoundaryCategory.WordLower */;
    }
    else if (charCode >= 65 /* CharCode.A */ && charCode <= 90 /* CharCode.Z */) {
        return 1 /* CharBoundaryCategory.WordUpper */;
    }
    else if (charCode >= 48 /* CharCode.Digit0 */ && charCode <= 57 /* CharCode.Digit9 */) {
        return 2 /* CharBoundaryCategory.WordNumber */;
    }
    else if (charCode === -1) {
        return 3 /* CharBoundaryCategory.End */;
    }
    else if (charCode === 44 /* CharCode.Comma */ || charCode === 59 /* CharCode.Semicolon */) {
        return 5 /* CharBoundaryCategory.Separator */;
    }
    else {
        return 4 /* CharBoundaryCategory.Other */;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function computeMovedLines(changes, originalLines, modifiedLines, hashedOriginalLines, hashedModifiedLines, timeout) {
    let { moves, excludedChanges } = computeMovesFromSimpleDeletionsToSimpleInsertions(changes, originalLines, modifiedLines, timeout);
    if (!timeout.isValid()) {
        return [];
    }
    const filteredChanges = changes.filter(c => !excludedChanges.has(c));
    const unchangedMoves = computeUnchangedMoves(filteredChanges, hashedOriginalLines, hashedModifiedLines, originalLines, modifiedLines, timeout);
    pushMany(moves, unchangedMoves);
    moves = joinCloseConsecutiveMoves(moves);
    // Ignore too short moves
    moves = moves.filter(current => {
        const lines = current.original.toOffsetRange().slice(originalLines).map(l => l.trim());
        const originalText = lines.join('\n');
        return originalText.length >= 15 && countWhere(lines, l => l.length >= 2) >= 2;
    });
    moves = removeMovesInSameDiff(changes, moves);
    return moves;
}
function countWhere(arr, predicate) {
    let count = 0;
    for (const t of arr) {
        if (predicate(t)) {
            count++;
        }
    }
    return count;
}
function computeMovesFromSimpleDeletionsToSimpleInsertions(changes, originalLines, modifiedLines, timeout) {
    const moves = [];
    const deletions = changes
        .filter(c => c.modified.isEmpty && c.original.length >= 3)
        .map(d => new LineRangeFragment(d.original, originalLines, d));
    const insertions = new Set(changes
        .filter(c => c.original.isEmpty && c.modified.length >= 3)
        .map(d => new LineRangeFragment(d.modified, modifiedLines, d)));
    const excludedChanges = new Set();
    for (const deletion of deletions) {
        let highestSimilarity = -1;
        let best;
        for (const insertion of insertions) {
            const similarity = deletion.computeSimilarity(insertion);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                best = insertion;
            }
        }
        if (highestSimilarity > 0.90 && best) {
            insertions.delete(best);
            moves.push(new LineRangeMapping(deletion.range, best.range));
            excludedChanges.add(deletion.source);
            excludedChanges.add(best.source);
        }
        if (!timeout.isValid()) {
            return { moves, excludedChanges };
        }
    }
    return { moves, excludedChanges };
}
function computeUnchangedMoves(changes, hashedOriginalLines, hashedModifiedLines, originalLines, modifiedLines, timeout) {
    const moves = [];
    const original3LineHashes = new SetMap();
    for (const change of changes) {
        for (let i = change.original.startLineNumber; i < change.original.endLineNumberExclusive - 2; i++) {
            const key = `${hashedOriginalLines[i - 1]}:${hashedOriginalLines[i + 1 - 1]}:${hashedOriginalLines[i + 2 - 1]}`;
            original3LineHashes.add(key, { range: new LineRange(i, i + 3) });
        }
    }
    const possibleMappings = [];
    changes.sort(compareBy(c => c.modified.startLineNumber, numberComparator));
    for (const change of changes) {
        let lastMappings = [];
        for (let i = change.modified.startLineNumber; i < change.modified.endLineNumberExclusive - 2; i++) {
            const key = `${hashedModifiedLines[i - 1]}:${hashedModifiedLines[i + 1 - 1]}:${hashedModifiedLines[i + 2 - 1]}`;
            const currentModifiedRange = new LineRange(i, i + 3);
            const nextMappings = [];
            original3LineHashes.forEach(key, ({ range }) => {
                for (const lastMapping of lastMappings) {
                    // does this match extend some last match?
                    if (lastMapping.originalLineRange.endLineNumberExclusive + 1 === range.endLineNumberExclusive &&
                        lastMapping.modifiedLineRange.endLineNumberExclusive + 1 === currentModifiedRange.endLineNumberExclusive) {
                        lastMapping.originalLineRange = new LineRange(lastMapping.originalLineRange.startLineNumber, range.endLineNumberExclusive);
                        lastMapping.modifiedLineRange = new LineRange(lastMapping.modifiedLineRange.startLineNumber, currentModifiedRange.endLineNumberExclusive);
                        nextMappings.push(lastMapping);
                        return;
                    }
                }
                const mapping = {
                    modifiedLineRange: currentModifiedRange,
                    originalLineRange: range,
                };
                possibleMappings.push(mapping);
                nextMappings.push(mapping);
            });
            lastMappings = nextMappings;
        }
        if (!timeout.isValid()) {
            return [];
        }
    }
    possibleMappings.sort(reverseOrder(compareBy(m => m.modifiedLineRange.length, numberComparator)));
    const modifiedSet = new LineRangeSet();
    const originalSet = new LineRangeSet();
    for (const mapping of possibleMappings) {
        const diffOrigToMod = mapping.modifiedLineRange.startLineNumber - mapping.originalLineRange.startLineNumber;
        const modifiedSections = modifiedSet.subtractFrom(mapping.modifiedLineRange);
        const originalTranslatedSections = originalSet.subtractFrom(mapping.originalLineRange).getWithDelta(diffOrigToMod);
        const modifiedIntersectedSections = modifiedSections.getIntersection(originalTranslatedSections);
        for (const s of modifiedIntersectedSections.ranges) {
            if (s.length < 3) {
                continue;
            }
            const modifiedLineRange = s;
            const originalLineRange = s.delta(-diffOrigToMod);
            moves.push(new LineRangeMapping(originalLineRange, modifiedLineRange));
            modifiedSet.addRange(modifiedLineRange);
            originalSet.addRange(originalLineRange);
        }
    }
    moves.sort(compareBy(m => m.original.startLineNumber, numberComparator));
    const monotonousChanges = new MonotonousArray(changes);
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const firstTouchingChangeOrig = monotonousChanges.findLastMonotonous(c => c.original.startLineNumber <= move.original.startLineNumber);
        const firstTouchingChangeMod = findLastMonotonous(changes, c => c.modified.startLineNumber <= move.modified.startLineNumber);
        const linesAbove = Math.max(move.original.startLineNumber - firstTouchingChangeOrig.original.startLineNumber, move.modified.startLineNumber - firstTouchingChangeMod.modified.startLineNumber);
        const lastTouchingChangeOrig = monotonousChanges.findLastMonotonous(c => c.original.startLineNumber < move.original.endLineNumberExclusive);
        const lastTouchingChangeMod = findLastMonotonous(changes, c => c.modified.startLineNumber < move.modified.endLineNumberExclusive);
        const linesBelow = Math.max(lastTouchingChangeOrig.original.endLineNumberExclusive - move.original.endLineNumberExclusive, lastTouchingChangeMod.modified.endLineNumberExclusive - move.modified.endLineNumberExclusive);
        let extendToTop;
        for (extendToTop = 0; extendToTop < linesAbove; extendToTop++) {
            const origLine = move.original.startLineNumber - extendToTop - 1;
            const modLine = move.modified.startLineNumber - extendToTop - 1;
            if (origLine > originalLines.length || modLine > modifiedLines.length) {
                break;
            }
            if (modifiedSet.contains(modLine) || originalSet.contains(origLine)) {
                break;
            }
            if (!areLinesSimilar(originalLines[origLine - 1], modifiedLines[modLine - 1], timeout)) {
                break;
            }
        }
        if (extendToTop > 0) {
            originalSet.addRange(new LineRange(move.original.startLineNumber - extendToTop, move.original.startLineNumber));
            modifiedSet.addRange(new LineRange(move.modified.startLineNumber - extendToTop, move.modified.startLineNumber));
        }
        let extendToBottom;
        for (extendToBottom = 0; extendToBottom < linesBelow; extendToBottom++) {
            const origLine = move.original.endLineNumberExclusive + extendToBottom;
            const modLine = move.modified.endLineNumberExclusive + extendToBottom;
            if (origLine > originalLines.length || modLine > modifiedLines.length) {
                break;
            }
            if (modifiedSet.contains(modLine) || originalSet.contains(origLine)) {
                break;
            }
            if (!areLinesSimilar(originalLines[origLine - 1], modifiedLines[modLine - 1], timeout)) {
                break;
            }
        }
        if (extendToBottom > 0) {
            originalSet.addRange(new LineRange(move.original.endLineNumberExclusive, move.original.endLineNumberExclusive + extendToBottom));
            modifiedSet.addRange(new LineRange(move.modified.endLineNumberExclusive, move.modified.endLineNumberExclusive + extendToBottom));
        }
        if (extendToTop > 0 || extendToBottom > 0) {
            moves[i] = new LineRangeMapping(new LineRange(move.original.startLineNumber - extendToTop, move.original.endLineNumberExclusive + extendToBottom), new LineRange(move.modified.startLineNumber - extendToTop, move.modified.endLineNumberExclusive + extendToBottom));
        }
    }
    return moves;
}
function areLinesSimilar(line1, line2, timeout) {
    if (line1.trim() === line2.trim()) {
        return true;
    }
    if (line1.length > 300 && line2.length > 300) {
        return false;
    }
    const myersDiffingAlgorithm = new MyersDiffAlgorithm();
    const result = myersDiffingAlgorithm.compute(new LinesSliceCharSequence([line1], new OffsetRange(0, 1), false), new LinesSliceCharSequence([line2], new OffsetRange(0, 1), false), timeout);
    let commonNonSpaceCharCount = 0;
    const inverted = SequenceDiff.invert(result.diffs, line1.length);
    for (const seq of inverted) {
        seq.seq1Range.forEach(idx => {
            if (!isSpace(line1.charCodeAt(idx))) {
                commonNonSpaceCharCount++;
            }
        });
    }
    function countNonWsChars(str) {
        let count = 0;
        for (let i = 0; i < line1.length; i++) {
            if (!isSpace(str.charCodeAt(i))) {
                count++;
            }
        }
        return count;
    }
    const longerLineLength = countNonWsChars(line1.length > line2.length ? line1 : line2);
    const r = commonNonSpaceCharCount / longerLineLength > 0.6 && longerLineLength > 10;
    return r;
}
function joinCloseConsecutiveMoves(moves) {
    if (moves.length === 0) {
        return moves;
    }
    moves.sort(compareBy(m => m.original.startLineNumber, numberComparator));
    const result = [moves[0]];
    for (let i = 1; i < moves.length; i++) {
        const last = result[result.length - 1];
        const current = moves[i];
        const originalDist = current.original.startLineNumber - last.original.endLineNumberExclusive;
        const modifiedDist = current.modified.startLineNumber - last.modified.endLineNumberExclusive;
        const currentMoveAfterLast = originalDist >= 0 && modifiedDist >= 0;
        if (currentMoveAfterLast && originalDist + modifiedDist <= 2) {
            result[result.length - 1] = last.join(current);
            continue;
        }
        result.push(current);
    }
    return result;
}
function removeMovesInSameDiff(changes, moves) {
    const changesMonotonous = new MonotonousArray(changes);
    moves = moves.filter(m => {
        const diffBeforeEndOfMoveOriginal = changesMonotonous.findLastMonotonous(c => c.original.startLineNumber < m.original.endLineNumberExclusive)
            || new LineRangeMapping(new LineRange(1, 1), new LineRange(1, 1));
        const diffBeforeEndOfMoveModified = findLastMonotonous(changes, c => c.modified.startLineNumber < m.modified.endLineNumberExclusive);
        const differentDiffs = diffBeforeEndOfMoveOriginal !== diffBeforeEndOfMoveModified;
        return differentDiffs;
    });
    return moves;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function optimizeSequenceDiffs(sequence1, sequence2, sequenceDiffs) {
    let result = sequenceDiffs;
    result = joinSequenceDiffsByShifting(sequence1, sequence2, result);
    // Sometimes, calling this function twice improves the result.
    // Uncomment the second invocation and run the tests to see the difference.
    result = joinSequenceDiffsByShifting(sequence1, sequence2, result);
    result = shiftSequenceDiffs(sequence1, sequence2, result);
    return result;
}
/**
 * This function fixes issues like this:
 * ```
 * import { Baz, Bar } from "foo";
 * ```
 * <->
 * ```
 * import { Baz, Bar, Foo } from "foo";
 * ```
 * Computed diff: [ {Add "," after Bar}, {Add "Foo " after space} }
 * Improved diff: [{Add ", Foo" after Bar}]
 */
function joinSequenceDiffsByShifting(sequence1, sequence2, sequenceDiffs) {
    if (sequenceDiffs.length === 0) {
        return sequenceDiffs;
    }
    const result = [];
    result.push(sequenceDiffs[0]);
    // First move them all to the left as much as possible and join them if possible
    for (let i = 1; i < sequenceDiffs.length; i++) {
        const prevResult = result[result.length - 1];
        let cur = sequenceDiffs[i];
        if (cur.seq1Range.isEmpty || cur.seq2Range.isEmpty) {
            const length = cur.seq1Range.start - prevResult.seq1Range.endExclusive;
            let d;
            for (d = 1; d <= length; d++) {
                if (sequence1.getElement(cur.seq1Range.start - d) !== sequence1.getElement(cur.seq1Range.endExclusive - d) ||
                    sequence2.getElement(cur.seq2Range.start - d) !== sequence2.getElement(cur.seq2Range.endExclusive - d)) {
                    break;
                }
            }
            d--;
            if (d === length) {
                // Merge previous and current diff
                result[result.length - 1] = new SequenceDiff(new OffsetRange(prevResult.seq1Range.start, cur.seq1Range.endExclusive - length), new OffsetRange(prevResult.seq2Range.start, cur.seq2Range.endExclusive - length));
                continue;
            }
            cur = cur.delta(-d);
        }
        result.push(cur);
    }
    const result2 = [];
    // Then move them all to the right and join them again if possible
    for (let i = 0; i < result.length - 1; i++) {
        const nextResult = result[i + 1];
        let cur = result[i];
        if (cur.seq1Range.isEmpty || cur.seq2Range.isEmpty) {
            const length = nextResult.seq1Range.start - cur.seq1Range.endExclusive;
            let d;
            for (d = 0; d < length; d++) {
                if (!sequence1.isStronglyEqual(cur.seq1Range.start + d, cur.seq1Range.endExclusive + d) ||
                    !sequence2.isStronglyEqual(cur.seq2Range.start + d, cur.seq2Range.endExclusive + d)) {
                    break;
                }
            }
            if (d === length) {
                // Merge previous and current diff, write to result!
                result[i + 1] = new SequenceDiff(new OffsetRange(cur.seq1Range.start + length, nextResult.seq1Range.endExclusive), new OffsetRange(cur.seq2Range.start + length, nextResult.seq2Range.endExclusive));
                continue;
            }
            if (d > 0) {
                cur = cur.delta(d);
            }
        }
        result2.push(cur);
    }
    if (result.length > 0) {
        result2.push(result[result.length - 1]);
    }
    return result2;
}
// align character level diffs at whitespace characters
// import { IBar } from "foo";
// import { I[Arr, I]Bar } from "foo";
// ->
// import { [IArr, ]IBar } from "foo";
// import { ITransaction, observableValue, transaction } from 'vs/base/common/observable';
// import { ITransaction, observable[FromEvent, observable]Value, transaction } from 'vs/base/common/observable';
// ->
// import { ITransaction, [observableFromEvent, ]observableValue, transaction } from 'vs/base/common/observable';
// collectBrackets(level + 1, levelPerBracketType);
// collectBrackets(level + 1, levelPerBracket[ + 1, levelPerBracket]Type);
// ->
// collectBrackets(level + 1, [levelPerBracket + 1, ]levelPerBracketType);
function shiftSequenceDiffs(sequence1, sequence2, sequenceDiffs) {
    if (!sequence1.getBoundaryScore || !sequence2.getBoundaryScore) {
        return sequenceDiffs;
    }
    for (let i = 0; i < sequenceDiffs.length; i++) {
        const prevDiff = (i > 0 ? sequenceDiffs[i - 1] : undefined);
        const diff = sequenceDiffs[i];
        const nextDiff = (i + 1 < sequenceDiffs.length ? sequenceDiffs[i + 1] : undefined);
        const seq1ValidRange = new OffsetRange(prevDiff ? prevDiff.seq1Range.endExclusive + 1 : 0, nextDiff ? nextDiff.seq1Range.start - 1 : sequence1.length);
        const seq2ValidRange = new OffsetRange(prevDiff ? prevDiff.seq2Range.endExclusive + 1 : 0, nextDiff ? nextDiff.seq2Range.start - 1 : sequence2.length);
        if (diff.seq1Range.isEmpty) {
            sequenceDiffs[i] = shiftDiffToBetterPosition(diff, sequence1, sequence2, seq1ValidRange, seq2ValidRange);
        }
        else if (diff.seq2Range.isEmpty) {
            sequenceDiffs[i] = shiftDiffToBetterPosition(diff.swap(), sequence2, sequence1, seq2ValidRange, seq1ValidRange).swap();
        }
    }
    return sequenceDiffs;
}
function shiftDiffToBetterPosition(diff, sequence1, sequence2, seq1ValidRange, seq2ValidRange) {
    const maxShiftLimit = 100; // To prevent performance issues
    // don't touch previous or next!
    let deltaBefore = 1;
    while (diff.seq1Range.start - deltaBefore >= seq1ValidRange.start &&
        diff.seq2Range.start - deltaBefore >= seq2ValidRange.start &&
        sequence2.isStronglyEqual(diff.seq2Range.start - deltaBefore, diff.seq2Range.endExclusive - deltaBefore) && deltaBefore < maxShiftLimit) {
        deltaBefore++;
    }
    deltaBefore--;
    let deltaAfter = 0;
    while (diff.seq1Range.start + deltaAfter < seq1ValidRange.endExclusive &&
        diff.seq2Range.endExclusive + deltaAfter < seq2ValidRange.endExclusive &&
        sequence2.isStronglyEqual(diff.seq2Range.start + deltaAfter, diff.seq2Range.endExclusive + deltaAfter) && deltaAfter < maxShiftLimit) {
        deltaAfter++;
    }
    if (deltaBefore === 0 && deltaAfter === 0) {
        return diff;
    }
    // Visualize `[sequence1.text, diff.seq1Range.start + deltaAfter]`
    // and `[sequence2.text, diff.seq2Range.start + deltaAfter, diff.seq2Range.endExclusive + deltaAfter]`
    let bestDelta = 0;
    let bestScore = -1;
    // find best scored delta
    for (let delta = -deltaBefore; delta <= deltaAfter; delta++) {
        const seq2OffsetStart = diff.seq2Range.start + delta;
        const seq2OffsetEndExclusive = diff.seq2Range.endExclusive + delta;
        const seq1Offset = diff.seq1Range.start + delta;
        const score = sequence1.getBoundaryScore(seq1Offset) + sequence2.getBoundaryScore(seq2OffsetStart) + sequence2.getBoundaryScore(seq2OffsetEndExclusive);
        if (score > bestScore) {
            bestScore = score;
            bestDelta = delta;
        }
    }
    return diff.delta(bestDelta);
}
function removeShortMatches(sequence1, sequence2, sequenceDiffs) {
    const result = [];
    for (const s of sequenceDiffs) {
        const last = result[result.length - 1];
        if (!last) {
            result.push(s);
            continue;
        }
        if (s.seq1Range.start - last.seq1Range.endExclusive <= 2 || s.seq2Range.start - last.seq2Range.endExclusive <= 2) {
            result[result.length - 1] = new SequenceDiff(last.seq1Range.join(s.seq1Range), last.seq2Range.join(s.seq2Range));
        }
        else {
            result.push(s);
        }
    }
    return result;
}
function extendDiffsToEntireWordIfAppropriate(sequence1, sequence2, sequenceDiffs) {
    const equalMappings = SequenceDiff.invert(sequenceDiffs, sequence1.length);
    const additional = [];
    let lastPoint = new OffsetPair(0, 0);
    function scanWord(pair, equalMapping) {
        if (pair.offset1 < lastPoint.offset1 || pair.offset2 < lastPoint.offset2) {
            return;
        }
        const w1 = sequence1.findWordContaining(pair.offset1);
        const w2 = sequence2.findWordContaining(pair.offset2);
        if (!w1 || !w2) {
            return;
        }
        let w = new SequenceDiff(w1, w2);
        const equalPart = w.intersect(equalMapping);
        let equalChars1 = equalPart.seq1Range.length;
        let equalChars2 = equalPart.seq2Range.length;
        // The words do not touch previous equals mappings, as we would have processed them already.
        // But they might touch the next ones.
        while (equalMappings.length > 0) {
            const next = equalMappings[0];
            const intersects = next.seq1Range.intersects(w.seq1Range) || next.seq2Range.intersects(w.seq2Range);
            if (!intersects) {
                break;
            }
            const v1 = sequence1.findWordContaining(next.seq1Range.start);
            const v2 = sequence2.findWordContaining(next.seq2Range.start);
            // Because there is an intersection, we know that the words are not empty.
            const v = new SequenceDiff(v1, v2);
            const equalPart = v.intersect(next);
            equalChars1 += equalPart.seq1Range.length;
            equalChars2 += equalPart.seq2Range.length;
            w = w.join(v);
            if (w.seq1Range.endExclusive >= next.seq1Range.endExclusive) {
                // The word extends beyond the next equal mapping.
                equalMappings.shift();
            }
            else {
                break;
            }
        }
        if (equalChars1 + equalChars2 < (w.seq1Range.length + w.seq2Range.length) * 2 / 3) {
            additional.push(w);
        }
        lastPoint = w.getEndExclusives();
    }
    while (equalMappings.length > 0) {
        const next = equalMappings.shift();
        if (next.seq1Range.isEmpty) {
            continue;
        }
        scanWord(next.getStarts(), next);
        // The equal parts are not empty, so -1 gives us a character that is equal in both parts.
        scanWord(next.getEndExclusives().delta(-1), next);
    }
    const merged = mergeSequenceDiffs(sequenceDiffs, additional);
    return merged;
}
function mergeSequenceDiffs(sequenceDiffs1, sequenceDiffs2) {
    const result = [];
    while (sequenceDiffs1.length > 0 || sequenceDiffs2.length > 0) {
        const sd1 = sequenceDiffs1[0];
        const sd2 = sequenceDiffs2[0];
        let next;
        if (sd1 && (!sd2 || sd1.seq1Range.start < sd2.seq1Range.start)) {
            next = sequenceDiffs1.shift();
        }
        else {
            next = sequenceDiffs2.shift();
        }
        if (result.length > 0 && result[result.length - 1].seq1Range.endExclusive >= next.seq1Range.start) {
            result[result.length - 1] = result[result.length - 1].join(next);
        }
        else {
            result.push(next);
        }
    }
    return result;
}
function removeVeryShortMatchingLinesBetweenDiffs(sequence1, _sequence2, sequenceDiffs) {
    let diffs = sequenceDiffs;
    if (diffs.length === 0) {
        return diffs;
    }
    let counter = 0;
    let shouldRepeat;
    do {
        shouldRepeat = false;
        const result = [
            diffs[0]
        ];
        for (let i = 1; i < diffs.length; i++) {
            const cur = diffs[i];
            const lastResult = result[result.length - 1];
            function shouldJoinDiffs(before, after) {
                const unchangedRange = new OffsetRange(lastResult.seq1Range.endExclusive, cur.seq1Range.start);
                const unchangedText = sequence1.getText(unchangedRange);
                const unchangedTextWithoutWs = unchangedText.replace(/\s/g, '');
                if (unchangedTextWithoutWs.length <= 4
                    && (before.seq1Range.length + before.seq2Range.length > 5 || after.seq1Range.length + after.seq2Range.length > 5)) {
                    return true;
                }
                return false;
            }
            const shouldJoin = shouldJoinDiffs(lastResult, cur);
            if (shouldJoin) {
                shouldRepeat = true;
                result[result.length - 1] = result[result.length - 1].join(cur);
            }
            else {
                result.push(cur);
            }
        }
        diffs = result;
    } while (counter++ < 10 && shouldRepeat);
    return diffs;
}
function removeVeryShortMatchingTextBetweenLongDiffs(sequence1, sequence2, sequenceDiffs) {
    let diffs = sequenceDiffs;
    if (diffs.length === 0) {
        return diffs;
    }
    let counter = 0;
    let shouldRepeat;
    do {
        shouldRepeat = false;
        const result = [
            diffs[0]
        ];
        for (let i = 1; i < diffs.length; i++) {
            const cur = diffs[i];
            const lastResult = result[result.length - 1];
            function shouldJoinDiffs(before, after) {
                const unchangedRange = new OffsetRange(lastResult.seq1Range.endExclusive, cur.seq1Range.start);
                const unchangedLineCount = sequence1.countLinesIn(unchangedRange);
                if (unchangedLineCount > 5 || unchangedRange.length > 500) {
                    return false;
                }
                const unchangedText = sequence1.getText(unchangedRange).trim();
                if (unchangedText.length > 20 || unchangedText.split(/\r\n|\r|\n/).length > 1) {
                    return false;
                }
                const beforeLineCount1 = sequence1.countLinesIn(before.seq1Range);
                const beforeSeq1Length = before.seq1Range.length;
                const beforeLineCount2 = sequence2.countLinesIn(before.seq2Range);
                const beforeSeq2Length = before.seq2Range.length;
                const afterLineCount1 = sequence1.countLinesIn(after.seq1Range);
                const afterSeq1Length = after.seq1Range.length;
                const afterLineCount2 = sequence2.countLinesIn(after.seq2Range);
                const afterSeq2Length = after.seq2Range.length;
                // TODO: Maybe a neural net can be used to derive the result from these numbers
                const max = 2 * 40 + 50;
                function cap(v) {
                    return Math.min(v, max);
                }
                if (Math.pow(Math.pow(cap(beforeLineCount1 * 40 + beforeSeq1Length), 1.5) + Math.pow(cap(beforeLineCount2 * 40 + beforeSeq2Length), 1.5), 1.5)
                    + Math.pow(Math.pow(cap(afterLineCount1 * 40 + afterSeq1Length), 1.5) + Math.pow(cap(afterLineCount2 * 40 + afterSeq2Length), 1.5), 1.5) > ((max ** 1.5) ** 1.5) * 1.3) {
                    return true;
                }
                return false;
            }
            const shouldJoin = shouldJoinDiffs(lastResult, cur);
            if (shouldJoin) {
                shouldRepeat = true;
                result[result.length - 1] = result[result.length - 1].join(cur);
            }
            else {
                result.push(cur);
            }
        }
        diffs = result;
    } while (counter++ < 10 && shouldRepeat);
    const newDiffs = [];
    // Remove short suffixes/prefixes
    forEachWithNeighbors(diffs, (prev, cur, next) => {
        let newDiff = cur;
        function shouldMarkAsChanged(text) {
            return text.length > 0 && text.trim().length <= 3 && cur.seq1Range.length + cur.seq2Range.length > 100;
        }
        const fullRange1 = sequence1.extendToFullLines(cur.seq1Range);
        const prefix = sequence1.getText(new OffsetRange(fullRange1.start, cur.seq1Range.start));
        if (shouldMarkAsChanged(prefix)) {
            newDiff = newDiff.deltaStart(-prefix.length);
        }
        const suffix = sequence1.getText(new OffsetRange(cur.seq1Range.endExclusive, fullRange1.endExclusive));
        if (shouldMarkAsChanged(suffix)) {
            newDiff = newDiff.deltaEnd(suffix.length);
        }
        const availableSpace = SequenceDiff.fromOffsetPairs(prev ? prev.getEndExclusives() : OffsetPair.zero, next ? next.getStarts() : OffsetPair.max);
        const result = newDiff.intersect(availableSpace);
        if (newDiffs.length > 0 && result.getStarts().equals(newDiffs[newDiffs.length - 1].getEndExclusives())) {
            newDiffs[newDiffs.length - 1] = newDiffs[newDiffs.length - 1].join(result);
        }
        else {
            newDiffs.push(result);
        }
    });
    return newDiffs;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class LineSequence {
    constructor(trimmedHash, lines) {
        this.trimmedHash = trimmedHash;
        this.lines = lines;
    }
    getElement(offset) {
        return this.trimmedHash[offset];
    }
    get length() {
        return this.trimmedHash.length;
    }
    getBoundaryScore(length) {
        const indentationBefore = length === 0 ? 0 : getIndentation(this.lines[length - 1]);
        const indentationAfter = length === this.lines.length ? 0 : getIndentation(this.lines[length]);
        return 1000 - (indentationBefore + indentationAfter);
    }
    getText(range) {
        return this.lines.slice(range.start, range.endExclusive).join('\n');
    }
    isStronglyEqual(offset1, offset2) {
        return this.lines[offset1] === this.lines[offset2];
    }
}
function getIndentation(str) {
    let i = 0;
    while (i < str.length && (str.charCodeAt(i) === 32 /* CharCode.Space */ || str.charCodeAt(i) === 9 /* CharCode.Tab */)) {
        i++;
    }
    return i;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class DefaultLinesDiffComputer {
    constructor() {
        this.dynamicProgrammingDiffing = new DynamicProgrammingDiffing();
        this.myersDiffingAlgorithm = new MyersDiffAlgorithm();
    }
    computeDiff(originalLines, modifiedLines, options) {
        if (originalLines.length <= 1 && equals(originalLines, modifiedLines, (a, b) => a === b)) {
            return new LinesDiff([], [], false);
        }
        if (originalLines.length === 1 && originalLines[0].length === 0 || modifiedLines.length === 1 && modifiedLines[0].length === 0) {
            return new LinesDiff([
                new DetailedLineRangeMapping(new LineRange(1, originalLines.length + 1), new LineRange(1, modifiedLines.length + 1), [
                    new RangeMapping(new Range(1, 1, originalLines.length, originalLines[originalLines.length - 1].length + 1), new Range(1, 1, modifiedLines.length, modifiedLines[modifiedLines.length - 1].length + 1))
                ])
            ], [], false);
        }
        const timeout = options.maxComputationTimeMs === 0 ? InfiniteTimeout.instance : new DateTimeout(options.maxComputationTimeMs);
        const considerWhitespaceChanges = !options.ignoreTrimWhitespace;
        const perfectHashes = new Map();
        function getOrCreateHash(text) {
            let hash = perfectHashes.get(text);
            if (hash === undefined) {
                hash = perfectHashes.size;
                perfectHashes.set(text, hash);
            }
            return hash;
        }
        const originalLinesHashes = originalLines.map((l) => getOrCreateHash(l.trim()));
        const modifiedLinesHashes = modifiedLines.map((l) => getOrCreateHash(l.trim()));
        const sequence1 = new LineSequence(originalLinesHashes, originalLines);
        const sequence2 = new LineSequence(modifiedLinesHashes, modifiedLines);
        const lineAlignmentResult = (() => {
            if (sequence1.length + sequence2.length < 1700) {
                // Use the improved algorithm for small files
                return this.dynamicProgrammingDiffing.compute(sequence1, sequence2, timeout, (offset1, offset2) => originalLines[offset1] === modifiedLines[offset2]
                    ? modifiedLines[offset2].length === 0
                        ? 0.1
                        : 1 + Math.log(1 + modifiedLines[offset2].length)
                    : 0.99);
            }
            return this.myersDiffingAlgorithm.compute(sequence1, sequence2, timeout);
        })();
        let lineAlignments = lineAlignmentResult.diffs;
        let hitTimeout = lineAlignmentResult.hitTimeout;
        lineAlignments = optimizeSequenceDiffs(sequence1, sequence2, lineAlignments);
        lineAlignments = removeVeryShortMatchingLinesBetweenDiffs(sequence1, sequence2, lineAlignments);
        const alignments = [];
        const scanForWhitespaceChanges = (equalLinesCount) => {
            if (!considerWhitespaceChanges) {
                return;
            }
            for (let i = 0; i < equalLinesCount; i++) {
                const seq1Offset = seq1LastStart + i;
                const seq2Offset = seq2LastStart + i;
                if (originalLines[seq1Offset] !== modifiedLines[seq2Offset]) {
                    // This is because of whitespace changes, diff these lines
                    const characterDiffs = this.refineDiff(originalLines, modifiedLines, new SequenceDiff(new OffsetRange(seq1Offset, seq1Offset + 1), new OffsetRange(seq2Offset, seq2Offset + 1)), timeout, considerWhitespaceChanges);
                    for (const a of characterDiffs.mappings) {
                        alignments.push(a);
                    }
                    if (characterDiffs.hitTimeout) {
                        hitTimeout = true;
                    }
                }
            }
        };
        let seq1LastStart = 0;
        let seq2LastStart = 0;
        for (const diff of lineAlignments) {
            assertFn(() => diff.seq1Range.start - seq1LastStart === diff.seq2Range.start - seq2LastStart);
            const equalLinesCount = diff.seq1Range.start - seq1LastStart;
            scanForWhitespaceChanges(equalLinesCount);
            seq1LastStart = diff.seq1Range.endExclusive;
            seq2LastStart = diff.seq2Range.endExclusive;
            const characterDiffs = this.refineDiff(originalLines, modifiedLines, diff, timeout, considerWhitespaceChanges);
            if (characterDiffs.hitTimeout) {
                hitTimeout = true;
            }
            for (const a of characterDiffs.mappings) {
                alignments.push(a);
            }
        }
        scanForWhitespaceChanges(originalLines.length - seq1LastStart);
        const changes = lineRangeMappingFromRangeMappings(alignments, originalLines, modifiedLines);
        let moves = [];
        if (options.computeMoves) {
            moves = this.computeMoves(changes, originalLines, modifiedLines, originalLinesHashes, modifiedLinesHashes, timeout, considerWhitespaceChanges);
        }
        // Make sure all ranges are valid
        assertFn(() => {
            function validatePosition(pos, lines) {
                if (pos.lineNumber < 1 || pos.lineNumber > lines.length) {
                    return false;
                }
                const line = lines[pos.lineNumber - 1];
                if (pos.column < 1 || pos.column > line.length + 1) {
                    return false;
                }
                return true;
            }
            function validateRange(range, lines) {
                if (range.startLineNumber < 1 || range.startLineNumber > lines.length + 1) {
                    return false;
                }
                if (range.endLineNumberExclusive < 1 || range.endLineNumberExclusive > lines.length + 1) {
                    return false;
                }
                return true;
            }
            for (const c of changes) {
                if (!c.innerChanges) {
                    return false;
                }
                for (const ic of c.innerChanges) {
                    const valid = validatePosition(ic.modifiedRange.getStartPosition(), modifiedLines) && validatePosition(ic.modifiedRange.getEndPosition(), modifiedLines) &&
                        validatePosition(ic.originalRange.getStartPosition(), originalLines) && validatePosition(ic.originalRange.getEndPosition(), originalLines);
                    if (!valid) {
                        return false;
                    }
                }
                if (!validateRange(c.modified, modifiedLines) || !validateRange(c.original, originalLines)) {
                    return false;
                }
            }
            return true;
        });
        return new LinesDiff(changes, moves, hitTimeout);
    }
    computeMoves(changes, originalLines, modifiedLines, hashedOriginalLines, hashedModifiedLines, timeout, considerWhitespaceChanges) {
        const moves = computeMovedLines(changes, originalLines, modifiedLines, hashedOriginalLines, hashedModifiedLines, timeout);
        const movesWithDiffs = moves.map(m => {
            const moveChanges = this.refineDiff(originalLines, modifiedLines, new SequenceDiff(m.original.toOffsetRange(), m.modified.toOffsetRange()), timeout, considerWhitespaceChanges);
            const mappings = lineRangeMappingFromRangeMappings(moveChanges.mappings, originalLines, modifiedLines, true);
            return new MovedText(m, mappings);
        });
        return movesWithDiffs;
    }
    refineDiff(originalLines, modifiedLines, diff, timeout, considerWhitespaceChanges) {
        const slice1 = new LinesSliceCharSequence(originalLines, diff.seq1Range, considerWhitespaceChanges);
        const slice2 = new LinesSliceCharSequence(modifiedLines, diff.seq2Range, considerWhitespaceChanges);
        const diffResult = slice1.length + slice2.length < 500
            ? this.dynamicProgrammingDiffing.compute(slice1, slice2, timeout)
            : this.myersDiffingAlgorithm.compute(slice1, slice2, timeout);
        let diffs = diffResult.diffs;
        diffs = optimizeSequenceDiffs(slice1, slice2, diffs);
        diffs = extendDiffsToEntireWordIfAppropriate(slice1, slice2, diffs);
        diffs = removeShortMatches(slice1, slice2, diffs);
        diffs = removeVeryShortMatchingTextBetweenLongDiffs(slice1, slice2, diffs);
        const result = diffs.map((d) => new RangeMapping(slice1.translateRange(d.seq1Range), slice2.translateRange(d.seq2Range)));
        // Assert: result applied on original should be the same as diff applied to original
        return {
            mappings: result,
            hitTimeout: diffResult.hitTimeout,
        };
    }
}
function lineRangeMappingFromRangeMappings(alignments, originalLines, modifiedLines, dontAssertStartLine = false) {
    const changes = [];
    for (const g of groupAdjacentBy(alignments.map(a => getLineRangeMapping(a, originalLines, modifiedLines)), (a1, a2) => a1.original.overlapOrTouch(a2.original)
        || a1.modified.overlapOrTouch(a2.modified))) {
        const first = g[0];
        const last = g[g.length - 1];
        changes.push(new DetailedLineRangeMapping(first.original.join(last.original), first.modified.join(last.modified), g.map(a => a.innerChanges[0])));
    }
    assertFn(() => {
        if (!dontAssertStartLine && changes.length > 0) {
            if (changes[0].modified.startLineNumber !== changes[0].original.startLineNumber) {
                return false;
            }
            if (modifiedLines.length - changes[changes.length - 1].modified.endLineNumberExclusive !== originalLines.length - changes[changes.length - 1].original.endLineNumberExclusive) {
                return false;
            }
        }
        return checkAdjacentItems(changes, (m1, m2) => m2.original.startLineNumber - m1.original.endLineNumberExclusive === m2.modified.startLineNumber - m1.modified.endLineNumberExclusive &&
            // There has to be an unchanged line in between (otherwise both diffs should have been joined)
            m1.original.endLineNumberExclusive < m2.original.startLineNumber &&
            m1.modified.endLineNumberExclusive < m2.modified.startLineNumber);
    });
    return changes;
}
function getLineRangeMapping(rangeMapping, originalLines, modifiedLines) {
    let lineStartDelta = 0;
    let lineEndDelta = 0;
    // rangeMapping describes the edit that replaces `rangeMapping.originalRange` with `newText := getText(modifiedLines, rangeMapping.modifiedRange)`.
    // original: ]xxx \n <- this line is not modified
    // modified: ]xx  \n
    if (rangeMapping.modifiedRange.endColumn === 1 && rangeMapping.originalRange.endColumn === 1
        && rangeMapping.originalRange.startLineNumber + lineStartDelta <= rangeMapping.originalRange.endLineNumber
        && rangeMapping.modifiedRange.startLineNumber + lineStartDelta <= rangeMapping.modifiedRange.endLineNumber) {
        // We can only do this if the range is not empty yet
        lineEndDelta = -1;
    }
    // original: xxx[ \n <- this line is not modified
    // modified: xxx[ \n
    if (rangeMapping.modifiedRange.startColumn - 1 >= modifiedLines[rangeMapping.modifiedRange.startLineNumber - 1].length
        && rangeMapping.originalRange.startColumn - 1 >= originalLines[rangeMapping.originalRange.startLineNumber - 1].length
        && rangeMapping.originalRange.startLineNumber <= rangeMapping.originalRange.endLineNumber + lineEndDelta
        && rangeMapping.modifiedRange.startLineNumber <= rangeMapping.modifiedRange.endLineNumber + lineEndDelta) {
        // We can only do this if the range is not empty yet
        lineStartDelta = 1;
    }
    const originalLineRange = new LineRange(rangeMapping.originalRange.startLineNumber + lineStartDelta, rangeMapping.originalRange.endLineNumber + 1 + lineEndDelta);
    const modifiedLineRange = new LineRange(rangeMapping.modifiedRange.startLineNumber + lineStartDelta, rangeMapping.modifiedRange.endLineNumber + 1 + lineEndDelta);
    return new DetailedLineRangeMapping(originalLineRange, modifiedLineRange, [rangeMapping]);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const linesDiffComputers = {
    getLegacy: () => new LegacyLinesDiffComputer(),
    getDefault: () => new DefaultLinesDiffComputer(),
};

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function roundFloat(number, decimalPoints) {
    const decimal = Math.pow(10, decimalPoints);
    return Math.round(number * decimal) / decimal;
}
class RGBA {
    constructor(r, g, b, a = 1) {
        this._rgbaBrand = undefined;
        this.r = Math.min(255, Math.max(0, r)) | 0;
        this.g = Math.min(255, Math.max(0, g)) | 0;
        this.b = Math.min(255, Math.max(0, b)) | 0;
        this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
    }
    static equals(a, b) {
        return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
    }
}
class HSLA {
    constructor(h, s, l, a) {
        this._hslaBrand = undefined;
        this.h = Math.max(Math.min(360, h), 0) | 0;
        this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
        this.l = roundFloat(Math.max(Math.min(1, l), 0), 3);
        this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
    }
    static equals(a, b) {
        return a.h === b.h && a.s === b.s && a.l === b.l && a.a === b.a;
    }
    /**
     * Converts an RGB color value to HSL. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes r, g, and b are contained in the set [0, 255] and
     * returns h in the set [0, 360], s, and l in the set [0, 1].
     */
    static fromRGBA(rgba) {
        const r = rgba.r / 255;
        const g = rgba.g / 255;
        const b = rgba.b / 255;
        const a = rgba.a;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (min + max) / 2;
        const chroma = max - min;
        if (chroma > 0) {
            s = Math.min((l <= 0.5 ? chroma / (2 * l) : chroma / (2 - (2 * l))), 1);
            switch (max) {
                case r:
                    h = (g - b) / chroma + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / chroma + 2;
                    break;
                case b:
                    h = (r - g) / chroma + 4;
                    break;
            }
            h *= 60;
            h = Math.round(h);
        }
        return new HSLA(h, s, l, a);
    }
    static _hue2rgb(p, q, t) {
        if (t < 0) {
            t += 1;
        }
        if (t > 1) {
            t -= 1;
        }
        if (t < 1 / 6) {
            return p + (q - p) * 6 * t;
        }
        if (t < 1 / 2) {
            return q;
        }
        if (t < 2 / 3) {
            return p + (q - p) * (2 / 3 - t) * 6;
        }
        return p;
    }
    /**
     * Converts an HSL color value to RGB. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
     * returns r, g, and b in the set [0, 255].
     */
    static toRGBA(hsla) {
        const h = hsla.h / 360;
        const { s, l, a } = hsla;
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        }
        else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = HSLA._hue2rgb(p, q, h + 1 / 3);
            g = HSLA._hue2rgb(p, q, h);
            b = HSLA._hue2rgb(p, q, h - 1 / 3);
        }
        return new RGBA(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a);
    }
}
class HSVA {
    constructor(h, s, v, a) {
        this._hsvaBrand = undefined;
        this.h = Math.max(Math.min(360, h), 0) | 0;
        this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
        this.v = roundFloat(Math.max(Math.min(1, v), 0), 3);
        this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
    }
    static equals(a, b) {
        return a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a;
    }
    // from http://www.rapidtables.com/convert/color/rgb-to-hsv.htm
    static fromRGBA(rgba) {
        const r = rgba.r / 255;
        const g = rgba.g / 255;
        const b = rgba.b / 255;
        const cmax = Math.max(r, g, b);
        const cmin = Math.min(r, g, b);
        const delta = cmax - cmin;
        const s = cmax === 0 ? 0 : (delta / cmax);
        let m;
        if (delta === 0) {
            m = 0;
        }
        else if (cmax === r) {
            m = ((((g - b) / delta) % 6) + 6) % 6;
        }
        else if (cmax === g) {
            m = ((b - r) / delta) + 2;
        }
        else {
            m = ((r - g) / delta) + 4;
        }
        return new HSVA(Math.round(m * 60), s, cmax, rgba.a);
    }
    // from http://www.rapidtables.com/convert/color/hsv-to-rgb.htm
    static toRGBA(hsva) {
        const { h, s, v, a } = hsva;
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let [r, g, b] = [0, 0, 0];
        if (h < 60) {
            r = c;
            g = x;
        }
        else if (h < 120) {
            r = x;
            g = c;
        }
        else if (h < 180) {
            g = c;
            b = x;
        }
        else if (h < 240) {
            g = x;
            b = c;
        }
        else if (h < 300) {
            r = x;
            b = c;
        }
        else if (h <= 360) {
            r = c;
            b = x;
        }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return new RGBA(r, g, b, a);
    }
}
class Color {
    static fromHex(hex) {
        return Color.Format.CSS.parseHex(hex) || Color.red;
    }
    static equals(a, b) {
        if (!a && !b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.equals(b);
    }
    get hsla() {
        if (this._hsla) {
            return this._hsla;
        }
        else {
            return HSLA.fromRGBA(this.rgba);
        }
    }
    get hsva() {
        if (this._hsva) {
            return this._hsva;
        }
        return HSVA.fromRGBA(this.rgba);
    }
    constructor(arg) {
        if (!arg) {
            throw new Error('Color needs a value');
        }
        else if (arg instanceof RGBA) {
            this.rgba = arg;
        }
        else if (arg instanceof HSLA) {
            this._hsla = arg;
            this.rgba = HSLA.toRGBA(arg);
        }
        else if (arg instanceof HSVA) {
            this._hsva = arg;
            this.rgba = HSVA.toRGBA(arg);
        }
        else {
            throw new Error('Invalid color ctor argument');
        }
    }
    equals(other) {
        return !!other && RGBA.equals(this.rgba, other.rgba) && HSLA.equals(this.hsla, other.hsla) && HSVA.equals(this.hsva, other.hsva);
    }
    /**
     * http://www.w3.org/TR/WCAG20/#relativeluminancedef
     * Returns the number in the set [0, 1]. O => Darkest Black. 1 => Lightest white.
     */
    getRelativeLuminance() {
        const R = Color._relativeLuminanceForComponent(this.rgba.r);
        const G = Color._relativeLuminanceForComponent(this.rgba.g);
        const B = Color._relativeLuminanceForComponent(this.rgba.b);
        const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        return roundFloat(luminance, 4);
    }
    static _relativeLuminanceForComponent(color) {
        const c = color / 255;
        return (c <= 0.03928) ? c / 12.92 : Math.pow(((c + 0.055) / 1.055), 2.4);
    }
    /**
     *	http://24ways.org/2010/calculating-color-contrast
     *  Return 'true' if lighter color otherwise 'false'
     */
    isLighter() {
        const yiq = (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1000;
        return yiq >= 128;
    }
    isLighterThan(another) {
        const lum1 = this.getRelativeLuminance();
        const lum2 = another.getRelativeLuminance();
        return lum1 > lum2;
    }
    isDarkerThan(another) {
        const lum1 = this.getRelativeLuminance();
        const lum2 = another.getRelativeLuminance();
        return lum1 < lum2;
    }
    lighten(factor) {
        return new Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * factor, this.hsla.a));
    }
    darken(factor) {
        return new Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * factor, this.hsla.a));
    }
    transparent(factor) {
        const { r, g, b, a } = this.rgba;
        return new Color(new RGBA(r, g, b, a * factor));
    }
    isTransparent() {
        return this.rgba.a === 0;
    }
    isOpaque() {
        return this.rgba.a === 1;
    }
    opposite() {
        return new Color(new RGBA(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
    }
    makeOpaque(opaqueBackground) {
        if (this.isOpaque() || opaqueBackground.rgba.a !== 1) {
            // only allow to blend onto a non-opaque color onto a opaque color
            return this;
        }
        const { r, g, b, a } = this.rgba;
        // https://stackoverflow.com/questions/12228548/finding-equivalent-color-with-opacity
        return new Color(new RGBA(opaqueBackground.rgba.r - a * (opaqueBackground.rgba.r - r), opaqueBackground.rgba.g - a * (opaqueBackground.rgba.g - g), opaqueBackground.rgba.b - a * (opaqueBackground.rgba.b - b), 1));
    }
    toString() {
        if (!this._toString) {
            this._toString = Color.Format.CSS.format(this);
        }
        return this._toString;
    }
    static getLighterColor(of, relative, factor) {
        if (of.isLighterThan(relative)) {
            return of;
        }
        factor = factor ? factor : 0.5;
        const lum1 = of.getRelativeLuminance();
        const lum2 = relative.getRelativeLuminance();
        factor = factor * (lum2 - lum1) / lum2;
        return of.lighten(factor);
    }
    static getDarkerColor(of, relative, factor) {
        if (of.isDarkerThan(relative)) {
            return of;
        }
        factor = factor ? factor : 0.5;
        const lum1 = of.getRelativeLuminance();
        const lum2 = relative.getRelativeLuminance();
        factor = factor * (lum1 - lum2) / lum1;
        return of.darken(factor);
    }
}
Color.white = new Color(new RGBA(255, 255, 255, 1));
Color.black = new Color(new RGBA(0, 0, 0, 1));
Color.red = new Color(new RGBA(255, 0, 0, 1));
Color.blue = new Color(new RGBA(0, 0, 255, 1));
Color.green = new Color(new RGBA(0, 255, 0, 1));
Color.cyan = new Color(new RGBA(0, 255, 255, 1));
Color.lightgrey = new Color(new RGBA(211, 211, 211, 1));
Color.transparent = new Color(new RGBA(0, 0, 0, 0));
(function (Color) {
    (function (Format) {
        (function (CSS) {
            function formatRGB(color) {
                if (color.rgba.a === 1) {
                    return `rgb(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b})`;
                }
                return Color.Format.CSS.formatRGBA(color);
            }
            CSS.formatRGB = formatRGB;
            function formatRGBA(color) {
                return `rgba(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b}, ${+(color.rgba.a).toFixed(2)})`;
            }
            CSS.formatRGBA = formatRGBA;
            function formatHSL(color) {
                if (color.hsla.a === 1) {
                    return `hsl(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%)`;
                }
                return Color.Format.CSS.formatHSLA(color);
            }
            CSS.formatHSL = formatHSL;
            function formatHSLA(color) {
                return `hsla(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%, ${color.hsla.a.toFixed(2)})`;
            }
            CSS.formatHSLA = formatHSLA;
            function _toTwoDigitHex(n) {
                const r = n.toString(16);
                return r.length !== 2 ? '0' + r : r;
            }
            /**
             * Formats the color as #RRGGBB
             */
            function formatHex(color) {
                return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}`;
            }
            CSS.formatHex = formatHex;
            /**
             * Formats the color as #RRGGBBAA
             * If 'compact' is set, colors without transparancy will be printed as #RRGGBB
             */
            function formatHexA(color, compact = false) {
                if (compact && color.rgba.a === 1) {
                    return Color.Format.CSS.formatHex(color);
                }
                return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}${_toTwoDigitHex(Math.round(color.rgba.a * 255))}`;
            }
            CSS.formatHexA = formatHexA;
            /**
             * The default format will use HEX if opaque and RGBA otherwise.
             */
            function format(color) {
                if (color.isOpaque()) {
                    return Color.Format.CSS.formatHex(color);
                }
                return Color.Format.CSS.formatRGBA(color);
            }
            CSS.format = format;
            /**
             * Converts an Hex color value to a Color.
             * returns r, g, and b are contained in the set [0, 255]
             * @param hex string (#RGB, #RGBA, #RRGGBB or #RRGGBBAA).
             */
            function parseHex(hex) {
                const length = hex.length;
                if (length === 0) {
                    // Invalid color
                    return null;
                }
                if (hex.charCodeAt(0) !== 35 /* CharCode.Hash */) {
                    // Does not begin with a #
                    return null;
                }
                if (length === 7) {
                    // #RRGGBB format
                    const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
                    const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
                    const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
                    return new Color(new RGBA(r, g, b, 1));
                }
                if (length === 9) {
                    // #RRGGBBAA format
                    const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
                    const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
                    const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
                    const a = 16 * _parseHexDigit(hex.charCodeAt(7)) + _parseHexDigit(hex.charCodeAt(8));
                    return new Color(new RGBA(r, g, b, a / 255));
                }
                if (length === 4) {
                    // #RGB format
                    const r = _parseHexDigit(hex.charCodeAt(1));
                    const g = _parseHexDigit(hex.charCodeAt(2));
                    const b = _parseHexDigit(hex.charCodeAt(3));
                    return new Color(new RGBA(16 * r + r, 16 * g + g, 16 * b + b));
                }
                if (length === 5) {
                    // #RGBA format
                    const r = _parseHexDigit(hex.charCodeAt(1));
                    const g = _parseHexDigit(hex.charCodeAt(2));
                    const b = _parseHexDigit(hex.charCodeAt(3));
                    const a = _parseHexDigit(hex.charCodeAt(4));
                    return new Color(new RGBA(16 * r + r, 16 * g + g, 16 * b + b, (16 * a + a) / 255));
                }
                // Invalid color
                return null;
            }
            CSS.parseHex = parseHex;
            function _parseHexDigit(charCode) {
                switch (charCode) {
                    case 48 /* CharCode.Digit0 */: return 0;
                    case 49 /* CharCode.Digit1 */: return 1;
                    case 50 /* CharCode.Digit2 */: return 2;
                    case 51 /* CharCode.Digit3 */: return 3;
                    case 52 /* CharCode.Digit4 */: return 4;
                    case 53 /* CharCode.Digit5 */: return 5;
                    case 54 /* CharCode.Digit6 */: return 6;
                    case 55 /* CharCode.Digit7 */: return 7;
                    case 56 /* CharCode.Digit8 */: return 8;
                    case 57 /* CharCode.Digit9 */: return 9;
                    case 97 /* CharCode.a */: return 10;
                    case 65 /* CharCode.A */: return 10;
                    case 98 /* CharCode.b */: return 11;
                    case 66 /* CharCode.B */: return 11;
                    case 99 /* CharCode.c */: return 12;
                    case 67 /* CharCode.C */: return 12;
                    case 100 /* CharCode.d */: return 13;
                    case 68 /* CharCode.D */: return 13;
                    case 101 /* CharCode.e */: return 14;
                    case 69 /* CharCode.E */: return 14;
                    case 102 /* CharCode.f */: return 15;
                    case 70 /* CharCode.F */: return 15;
                }
                return 0;
            }
        })(Format.CSS || (Format.CSS = {}));
    })(Color.Format || (Color.Format = {}));
})(Color || (Color = {}));

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function _parseCaptureGroups(captureGroups) {
    const values = [];
    for (const captureGroup of captureGroups) {
        const parsedNumber = Number(captureGroup);
        if (parsedNumber || parsedNumber === 0 && captureGroup.replace(/\s/g, '') !== '') {
            values.push(parsedNumber);
        }
    }
    return values;
}
function _toIColor(r, g, b, a) {
    return {
        red: r / 255,
        blue: b / 255,
        green: g / 255,
        alpha: a
    };
}
function _findRange(model, match) {
    const index = match.index;
    const length = match[0].length;
    if (!index) {
        return;
    }
    const startPosition = model.positionAt(index);
    const range = {
        startLineNumber: startPosition.lineNumber,
        startColumn: startPosition.column,
        endLineNumber: startPosition.lineNumber,
        endColumn: startPosition.column + length
    };
    return range;
}
function _findHexColorInformation(range, hexValue) {
    if (!range) {
        return;
    }
    const parsedHexColor = Color.Format.CSS.parseHex(hexValue);
    if (!parsedHexColor) {
        return;
    }
    return {
        range: range,
        color: _toIColor(parsedHexColor.rgba.r, parsedHexColor.rgba.g, parsedHexColor.rgba.b, parsedHexColor.rgba.a)
    };
}
function _findRGBColorInformation(range, matches, isAlpha) {
    if (!range || matches.length !== 1) {
        return;
    }
    const match = matches[0];
    const captureGroups = match.values();
    const parsedRegex = _parseCaptureGroups(captureGroups);
    return {
        range: range,
        color: _toIColor(parsedRegex[0], parsedRegex[1], parsedRegex[2], isAlpha ? parsedRegex[3] : 1)
    };
}
function _findHSLColorInformation(range, matches, isAlpha) {
    if (!range || matches.length !== 1) {
        return;
    }
    const match = matches[0];
    const captureGroups = match.values();
    const parsedRegex = _parseCaptureGroups(captureGroups);
    const colorEquivalent = new Color(new HSLA(parsedRegex[0], parsedRegex[1] / 100, parsedRegex[2] / 100, isAlpha ? parsedRegex[3] : 1));
    return {
        range: range,
        color: _toIColor(colorEquivalent.rgba.r, colorEquivalent.rgba.g, colorEquivalent.rgba.b, colorEquivalent.rgba.a)
    };
}
function _findMatches(model, regex) {
    if (typeof model === 'string') {
        return [...model.matchAll(regex)];
    }
    else {
        return model.findMatches(regex);
    }
}
function computeColors(model) {
    const result = [];
    // Early validation for RGB and HSL
    const initialValidationRegex = /\b(rgb|rgba|hsl|hsla)(\([0-9\s,.\%]*\))|(#)([A-Fa-f0-9]{3})\b|(#)([A-Fa-f0-9]{4})\b|(#)([A-Fa-f0-9]{6})\b|(#)([A-Fa-f0-9]{8})\b/gm;
    const initialValidationMatches = _findMatches(model, initialValidationRegex);
    // Potential colors have been found, validate the parameters
    if (initialValidationMatches.length > 0) {
        for (const initialMatch of initialValidationMatches) {
            const initialCaptureGroups = initialMatch.filter(captureGroup => captureGroup !== undefined);
            const colorScheme = initialCaptureGroups[1];
            const colorParameters = initialCaptureGroups[2];
            if (!colorParameters) {
                continue;
            }
            let colorInformation;
            if (colorScheme === 'rgb') {
                const regexParameters = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*\)$/gm;
                colorInformation = _findRGBColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), false);
            }
            else if (colorScheme === 'rgba') {
                const regexParameters = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
                colorInformation = _findRGBColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), true);
            }
            else if (colorScheme === 'hsl') {
                const regexParameters = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*\)$/gm;
                colorInformation = _findHSLColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), false);
            }
            else if (colorScheme === 'hsla') {
                const regexParameters = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
                colorInformation = _findHSLColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), true);
            }
            else if (colorScheme === '#') {
                colorInformation = _findHexColorInformation(_findRange(model, initialMatch), colorScheme + colorParameters);
            }
            if (colorInformation) {
                result.push(colorInformation);
            }
        }
    }
    return result;
}
/**
 * Returns an array of all default document colors in the provided document
 */
function computeDefaultDocumentColors(model) {
    if (!model || typeof model.getValue !== 'function' || typeof model.positionAt !== 'function') {
        // Unknown caller!
        return [];
    }
    return computeColors(model);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const markRegex = new RegExp('\\bMARK:\\s*(.*)$', 'd');
const trimDashesRegex = /^-+|-+$/g;
/**
 * Find section headers in the model.
 *
 * @param model the text model to search in
 * @param options options to search with
 * @returns an array of section headers
 */
function findSectionHeaders(model, options) {
    var _a;
    let headers = [];
    if (options.findRegionSectionHeaders && ((_a = options.foldingRules) === null || _a === void 0 ? void 0 : _a.markers)) {
        const regionHeaders = collectRegionHeaders(model, options);
        headers = headers.concat(regionHeaders);
    }
    if (options.findMarkSectionHeaders) {
        const markHeaders = collectMarkHeaders(model);
        headers = headers.concat(markHeaders);
    }
    return headers;
}
function collectRegionHeaders(model, options) {
    const regionHeaders = [];
    const endLineNumber = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= endLineNumber; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const match = lineContent.match(options.foldingRules.markers.start);
        if (match) {
            const range = { startLineNumber: lineNumber, startColumn: match[0].length + 1, endLineNumber: lineNumber, endColumn: lineContent.length + 1 };
            if (range.endColumn > range.startColumn) {
                const sectionHeader = {
                    range,
                    ...getHeaderText(lineContent.substring(match[0].length)),
                    shouldBeInComments: false
                };
                if (sectionHeader.text || sectionHeader.hasSeparatorLine) {
                    regionHeaders.push(sectionHeader);
                }
            }
        }
    }
    return regionHeaders;
}
function collectMarkHeaders(model) {
    const markHeaders = [];
    const endLineNumber = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= endLineNumber; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        addMarkHeaderIfFound(lineContent, lineNumber, markHeaders);
    }
    return markHeaders;
}
function addMarkHeaderIfFound(lineContent, lineNumber, sectionHeaders) {
    markRegex.lastIndex = 0;
    const match = markRegex.exec(lineContent);
    if (match) {
        const column = match.indices[1][0] + 1;
        const endColumn = match.indices[1][1] + 1;
        const range = { startLineNumber: lineNumber, startColumn: column, endLineNumber: lineNumber, endColumn: endColumn };
        if (range.endColumn > range.startColumn) {
            const sectionHeader = {
                range,
                ...getHeaderText(match[1]),
                shouldBeInComments: true
            };
            if (sectionHeader.text || sectionHeader.hasSeparatorLine) {
                sectionHeaders.push(sectionHeader);
            }
        }
    }
}
function getHeaderText(text) {
    text = text.trim();
    const hasSeparatorLine = text.startsWith('-');
    text = text.replace(trimDashesRegex, '');
    return { text, hasSeparatorLine };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * @internal
 */
class MirrorModel extends MirrorTextModel {
    get uri() {
        return this._uri;
    }
    get eol() {
        return this._eol;
    }
    getValue() {
        return this.getText();
    }
    findMatches(regex) {
        const matches = [];
        for (let i = 0; i < this._lines.length; i++) {
            const line = this._lines[i];
            const offsetToAdd = this.offsetAt(new Position(i + 1, 1));
            const iteratorOverMatches = line.matchAll(regex);
            for (const match of iteratorOverMatches) {
                if (match.index || match.index === 0) {
                    match.index = match.index + offsetToAdd;
                }
                matches.push(match);
            }
        }
        return matches;
    }
    getLinesContent() {
        return this._lines.slice(0);
    }
    getLineCount() {
        return this._lines.length;
    }
    getLineContent(lineNumber) {
        return this._lines[lineNumber - 1];
    }
    getWordAtPosition(position, wordDefinition) {
        const wordAtText = getWordAtText(position.column, ensureValidWordDefinition(wordDefinition), this._lines[position.lineNumber - 1], 0);
        if (wordAtText) {
            return new Range(position.lineNumber, wordAtText.startColumn, position.lineNumber, wordAtText.endColumn);
        }
        return null;
    }
    words(wordDefinition) {
        const lines = this._lines;
        const wordenize = this._wordenize.bind(this);
        let lineNumber = 0;
        let lineText = '';
        let wordRangesIdx = 0;
        let wordRanges = [];
        return {
            *[Symbol.iterator]() {
                while (true) {
                    if (wordRangesIdx < wordRanges.length) {
                        const value = lineText.substring(wordRanges[wordRangesIdx].start, wordRanges[wordRangesIdx].end);
                        wordRangesIdx += 1;
                        yield value;
                    }
                    else {
                        if (lineNumber < lines.length) {
                            lineText = lines[lineNumber];
                            wordRanges = wordenize(lineText, wordDefinition);
                            wordRangesIdx = 0;
                            lineNumber += 1;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        };
    }
    getLineWords(lineNumber, wordDefinition) {
        const content = this._lines[lineNumber - 1];
        const ranges = this._wordenize(content, wordDefinition);
        const words = [];
        for (const range of ranges) {
            words.push({
                word: content.substring(range.start, range.end),
                startColumn: range.start + 1,
                endColumn: range.end + 1
            });
        }
        return words;
    }
    _wordenize(content, wordDefinition) {
        const result = [];
        let match;
        wordDefinition.lastIndex = 0; // reset lastIndex just to be sure
        while (match = wordDefinition.exec(content)) {
            if (match[0].length === 0) {
                // it did match the empty string
                break;
            }
            result.push({ start: match.index, end: match.index + match[0].length });
        }
        return result;
    }
    getValueInRange(range) {
        range = this._validateRange(range);
        if (range.startLineNumber === range.endLineNumber) {
            return this._lines[range.startLineNumber - 1].substring(range.startColumn - 1, range.endColumn - 1);
        }
        const lineEnding = this._eol;
        const startLineIndex = range.startLineNumber - 1;
        const endLineIndex = range.endLineNumber - 1;
        const resultLines = [];
        resultLines.push(this._lines[startLineIndex].substring(range.startColumn - 1));
        for (let i = startLineIndex + 1; i < endLineIndex; i++) {
            resultLines.push(this._lines[i]);
        }
        resultLines.push(this._lines[endLineIndex].substring(0, range.endColumn - 1));
        return resultLines.join(lineEnding);
    }
    offsetAt(position) {
        position = this._validatePosition(position);
        this._ensureLineStarts();
        return this._lineStarts.getPrefixSum(position.lineNumber - 2) + (position.column - 1);
    }
    positionAt(offset) {
        offset = Math.floor(offset);
        offset = Math.max(0, offset);
        this._ensureLineStarts();
        const out = this._lineStarts.getIndexOf(offset);
        const lineLength = this._lines[out.index].length;
        // Ensure we return a valid position
        return {
            lineNumber: 1 + out.index,
            column: 1 + Math.min(out.remainder, lineLength)
        };
    }
    _validateRange(range) {
        const start = this._validatePosition({ lineNumber: range.startLineNumber, column: range.startColumn });
        const end = this._validatePosition({ lineNumber: range.endLineNumber, column: range.endColumn });
        if (start.lineNumber !== range.startLineNumber
            || start.column !== range.startColumn
            || end.lineNumber !== range.endLineNumber
            || end.column !== range.endColumn) {
            return {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column
            };
        }
        return range;
    }
    _validatePosition(position) {
        if (!Position.isIPosition(position)) {
            throw new Error('bad position');
        }
        let { lineNumber, column } = position;
        let hasChanged = false;
        if (lineNumber < 1) {
            lineNumber = 1;
            column = 1;
            hasChanged = true;
        }
        else if (lineNumber > this._lines.length) {
            lineNumber = this._lines.length;
            column = this._lines[lineNumber - 1].length + 1;
            hasChanged = true;
        }
        else {
            const maxCharacter = this._lines[lineNumber - 1].length + 1;
            if (column < 1) {
                column = 1;
                hasChanged = true;
            }
            else if (column > maxCharacter) {
                column = maxCharacter;
                hasChanged = true;
            }
        }
        if (!hasChanged) {
            return position;
        }
        else {
            return { lineNumber, column };
        }
    }
}
/**
 * @internal
 */
class EditorSimpleWorker {
    constructor(host, foreignModuleFactory) {
        this._host = host;
        this._models = Object.create(null);
        this._foreignModuleFactory = foreignModuleFactory;
        this._foreignModule = null;
    }
    dispose() {
        this._models = Object.create(null);
    }
    _getModel(uri) {
        return this._models[uri];
    }
    _getModels() {
        const all = [];
        Object.keys(this._models).forEach((key) => all.push(this._models[key]));
        return all;
    }
    acceptNewModel(data) {
        this._models[data.url] = new MirrorModel(URI.parse(data.url), data.lines, data.EOL, data.versionId);
    }
    acceptModelChanged(strURL, e) {
        if (!this._models[strURL]) {
            return;
        }
        const model = this._models[strURL];
        model.onEvents(e);
    }
    acceptRemovedModel(strURL) {
        if (!this._models[strURL]) {
            return;
        }
        delete this._models[strURL];
    }
    async computeUnicodeHighlights(url, options, range) {
        const model = this._getModel(url);
        if (!model) {
            return { ranges: [], hasMore: false, ambiguousCharacterCount: 0, invisibleCharacterCount: 0, nonBasicAsciiCharacterCount: 0 };
        }
        return UnicodeTextModelHighlighter.computeUnicodeHighlights(model, options, range);
    }
    async findSectionHeaders(url, options) {
        const model = this._getModel(url);
        if (!model) {
            return [];
        }
        return findSectionHeaders(model, options);
    }
    // ---- BEGIN diff --------------------------------------------------------------------------
    async computeDiff(originalUrl, modifiedUrl, options, algorithm) {
        const original = this._getModel(originalUrl);
        const modified = this._getModel(modifiedUrl);
        if (!original || !modified) {
            return null;
        }
        const result = EditorSimpleWorker.computeDiff(original, modified, options, algorithm);
        return result;
    }
    static computeDiff(originalTextModel, modifiedTextModel, options, algorithm) {
        const diffAlgorithm = algorithm === 'advanced' ? linesDiffComputers.getDefault() : linesDiffComputers.getLegacy();
        const originalLines = originalTextModel.getLinesContent();
        const modifiedLines = modifiedTextModel.getLinesContent();
        const result = diffAlgorithm.computeDiff(originalLines, modifiedLines, options);
        const identical = (result.changes.length > 0 ? false : this._modelsAreIdentical(originalTextModel, modifiedTextModel));
        function getLineChanges(changes) {
            return changes.map(m => {
                var _a;
                return ([m.original.startLineNumber, m.original.endLineNumberExclusive, m.modified.startLineNumber, m.modified.endLineNumberExclusive, (_a = m.innerChanges) === null || _a === void 0 ? void 0 : _a.map(m => [
                        m.originalRange.startLineNumber,
                        m.originalRange.startColumn,
                        m.originalRange.endLineNumber,
                        m.originalRange.endColumn,
                        m.modifiedRange.startLineNumber,
                        m.modifiedRange.startColumn,
                        m.modifiedRange.endLineNumber,
                        m.modifiedRange.endColumn,
                    ])]);
            });
        }
        return {
            identical,
            quitEarly: result.hitTimeout,
            changes: getLineChanges(result.changes),
            moves: result.moves.map(m => ([
                m.lineRangeMapping.original.startLineNumber,
                m.lineRangeMapping.original.endLineNumberExclusive,
                m.lineRangeMapping.modified.startLineNumber,
                m.lineRangeMapping.modified.endLineNumberExclusive,
                getLineChanges(m.changes)
            ])),
        };
    }
    static _modelsAreIdentical(original, modified) {
        const originalLineCount = original.getLineCount();
        const modifiedLineCount = modified.getLineCount();
        if (originalLineCount !== modifiedLineCount) {
            return false;
        }
        for (let line = 1; line <= originalLineCount; line++) {
            const originalLine = original.getLineContent(line);
            const modifiedLine = modified.getLineContent(line);
            if (originalLine !== modifiedLine) {
                return false;
            }
        }
        return true;
    }
    async computeMoreMinimalEdits(modelUrl, edits, pretty) {
        const model = this._getModel(modelUrl);
        if (!model) {
            return edits;
        }
        const result = [];
        let lastEol = undefined;
        edits = edits.slice(0).sort((a, b) => {
            if (a.range && b.range) {
                return Range.compareRangesUsingStarts(a.range, b.range);
            }
            // eol only changes should go to the end
            const aRng = a.range ? 0 : 1;
            const bRng = b.range ? 0 : 1;
            return aRng - bRng;
        });
        // merge adjacent edits
        let writeIndex = 0;
        for (let readIndex = 1; readIndex < edits.length; readIndex++) {
            if (Range.getEndPosition(edits[writeIndex].range).equals(Range.getStartPosition(edits[readIndex].range))) {
                edits[writeIndex].range = Range.fromPositions(Range.getStartPosition(edits[writeIndex].range), Range.getEndPosition(edits[readIndex].range));
                edits[writeIndex].text += edits[readIndex].text;
            }
            else {
                writeIndex++;
                edits[writeIndex] = edits[readIndex];
            }
        }
        edits.length = writeIndex + 1;
        for (let { range, text, eol } of edits) {
            if (typeof eol === 'number') {
                lastEol = eol;
            }
            if (Range.isEmpty(range) && !text) {
                // empty change
                continue;
            }
            const original = model.getValueInRange(range);
            text = text.replace(/\r\n|\n|\r/g, model.eol);
            if (original === text) {
                // noop
                continue;
            }
            // make sure diff won't take too long
            if (Math.max(text.length, original.length) > EditorSimpleWorker._diffLimit) {
                result.push({ range, text });
                continue;
            }
            // compute diff between original and edit.text
            const changes = stringDiff(original, text, pretty);
            const editOffset = model.offsetAt(Range.lift(range).getStartPosition());
            for (const change of changes) {
                const start = model.positionAt(editOffset + change.originalStart);
                const end = model.positionAt(editOffset + change.originalStart + change.originalLength);
                const newEdit = {
                    text: text.substr(change.modifiedStart, change.modifiedLength),
                    range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column }
                };
                if (model.getValueInRange(newEdit.range) !== newEdit.text) {
                    result.push(newEdit);
                }
            }
        }
        if (typeof lastEol === 'number') {
            result.push({ eol: lastEol, text: '', range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } });
        }
        return result;
    }
    // ---- END minimal edits ---------------------------------------------------------------
    async computeLinks(modelUrl) {
        const model = this._getModel(modelUrl);
        if (!model) {
            return null;
        }
        return computeLinks(model);
    }
    // --- BEGIN default document colors -----------------------------------------------------------
    async computeDefaultDocumentColors(modelUrl) {
        const model = this._getModel(modelUrl);
        if (!model) {
            return null;
        }
        return computeDefaultDocumentColors(model);
    }
    async textualSuggest(modelUrls, leadingWord, wordDef, wordDefFlags) {
        const sw = new StopWatch();
        const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
        const seen = new Set();
        outer: for (const url of modelUrls) {
            const model = this._getModel(url);
            if (!model) {
                continue;
            }
            for (const word of model.words(wordDefRegExp)) {
                if (word === leadingWord || !isNaN(Number(word))) {
                    continue;
                }
                seen.add(word);
                if (seen.size > EditorSimpleWorker._suggestionsLimit) {
                    break outer;
                }
            }
        }
        return { words: Array.from(seen), duration: sw.elapsed() };
    }
    // ---- END suggest --------------------------------------------------------------------------
    //#region -- word ranges --
    async computeWordRanges(modelUrl, range, wordDef, wordDefFlags) {
        const model = this._getModel(modelUrl);
        if (!model) {
            return Object.create(null);
        }
        const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
        const result = Object.create(null);
        for (let line = range.startLineNumber; line < range.endLineNumber; line++) {
            const words = model.getLineWords(line, wordDefRegExp);
            for (const word of words) {
                if (!isNaN(Number(word.word))) {
                    continue;
                }
                let array = result[word.word];
                if (!array) {
                    array = [];
                    result[word.word] = array;
                }
                array.push({
                    startLineNumber: line,
                    startColumn: word.startColumn,
                    endLineNumber: line,
                    endColumn: word.endColumn
                });
            }
        }
        return result;
    }
    //#endregion
    async navigateValueSet(modelUrl, range, up, wordDef, wordDefFlags) {
        const model = this._getModel(modelUrl);
        if (!model) {
            return null;
        }
        const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
        if (range.startColumn === range.endColumn) {
            range = {
                startLineNumber: range.startLineNumber,
                startColumn: range.startColumn,
                endLineNumber: range.endLineNumber,
                endColumn: range.endColumn + 1
            };
        }
        const selectionText = model.getValueInRange(range);
        const wordRange = model.getWordAtPosition({ lineNumber: range.startLineNumber, column: range.startColumn }, wordDefRegExp);
        if (!wordRange) {
            return null;
        }
        const word = model.getValueInRange(wordRange);
        const result = BasicInplaceReplace.INSTANCE.navigateValueSet(range, selectionText, wordRange, word, up);
        return result;
    }
    // ---- BEGIN foreign module support --------------------------------------------------------------------------
    loadForeignModule(moduleId, createData, foreignHostMethods) {
        const proxyMethodRequest = (method, args) => {
            return this._host.fhr(method, args);
        };
        const foreignHost = createProxyObject$1(foreignHostMethods, proxyMethodRequest);
        const ctx = {
            host: foreignHost,
            getMirrorModels: () => {
                return this._getModels();
            }
        };
        if (this._foreignModuleFactory) {
            this._foreignModule = this._foreignModuleFactory(ctx, createData);
            // static foreing module
            return Promise.resolve(getAllMethodNames(this._foreignModule));
        }
        // ESM-comment-begin
        // 		return new Promise<any>((resolve, reject) => {
        // 			require([moduleId], (foreignModule: { create: IForeignModuleFactory }) => {
        // 				this._foreignModule = foreignModule.create(ctx, createData);
        // 
        // 				resolve(getAllMethodNames(this._foreignModule));
        // 
        // 			}, reject);
        // 		});
        // ESM-comment-end
        // ESM-uncomment-begin
        return Promise.reject(new Error(`Unexpected usage`));
        // ESM-uncomment-end
    }
    // foreign method request
    fmr(method, args) {
        if (!this._foreignModule || typeof this._foreignModule[method] !== 'function') {
            return Promise.reject(new Error('Missing requestHandler or method: ' + method));
        }
        try {
            return Promise.resolve(this._foreignModule[method].apply(this._foreignModule, args));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
}
// ---- END diff --------------------------------------------------------------------------
// ---- BEGIN minimal edits ---------------------------------------------------------------
EditorSimpleWorker._diffLimit = 100000;
// ---- BEGIN suggest --------------------------------------------------------------------------
EditorSimpleWorker._suggestionsLimit = 10000;
if (typeof importScripts === 'function') {
    // Running in a web worker
    globalThis.monaco = createMonacoBaseAPI();
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
let initialized = false;
function initialize(foreignModule) {
    if (initialized) {
        return;
    }
    initialized = true;
    const simpleWorker = new SimpleWorkerServer((msg) => {
        globalThis.postMessage(msg);
    }, (host) => new EditorSimpleWorker(host, foreignModule));
    globalThis.onmessage = (e) => {
        simpleWorker.onmessage(e.data);
    };
}
globalThis.onmessage = (e) => {
    // Ignore first message in this case and initialize if not yet initialized
    if (!initialized) {
        initialize(null);
    }
};
