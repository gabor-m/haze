var immutable = require("./lib/immutable.min.js");
var big_float = require("./lib/big_float.js");

var runtime = {
    
    fail: function (v) {
        throw v;
    },
    
    // Values
    
    null: function () {
        return {
            type: "null"
        };
    },
    boolean: function (v) {
        return {
            type: "boolean",
            value: v
        };
    },
    number: function (str) {
        var n = Number(str);
        if (!isFinite(n)) {
            return runtime.fail("Number is too large to be represented");
        }
        return {
            type: "number",
            value: n
        };
    },
    string: function (str) {
        return {
            type: "string",
            value: str
        };
    },
    array: function (elems) {
        elems = elems || [];
        var list = immutable.List();
        elems.forEach(function (elem) {
            list = list.push(elem);
        });
        return {
            type: "array",
            value: list
        };
    },
    record: function (entries) {
        entries = entries || [];
        var map = immutable.OrderedMap();
        entries.forEach(function (entry) {
            if (entry.type !== "null") {
                map = map.set(entry[0], entry[1]);
            }
        });
        return {
            type: "record",
            value: map
        };
    },
    function: function (js_func) {
        return {
            type: "function",
            value: js_func
        };
    },
    
    // Convert JS value to Haze value
    from_js: function (v) {
        var t = typeof v;
        if (v === null) {
            t = "null";
        }
        if (Array.isArray(v)) {
            t = "array";
        }
        switch (t) {
        case "null":
            return runtime.null();
        case "boolean":
            return runtime.boolean(v);
        case "number":
            return runtime.number(String(v));
        case "string":
            return runtime.string(v);
        case "array":
            var array = runtime.array();
            v.forEach(function (item) {
                array.value = array.value.push(runtime.from_js(item));
            });
            return array;
        case "object":
            var record = runtime.record();
            Object.keys(v).forEach(function (key) {
                var val = runtime.from_js(v[key]);
                if (val.type !== "null") {
                    record.value = record.value.set(key, val);
                }
            });
            return record;
        }
    },
    
    // Operations
    
    quote: function (source_string) {
        var str = "";
        source_string.split("").forEach(function (c) {
            if (c === "\t") {
                str += "\\t";
            } else if (c === "\r") {
                str += "\\r";
            } else if (c === "\n") {
                str += "\\n";
            } else if (c < ' ') {
                str += '\\u{' + Number(c.charCodeAt(0)).toString(16) + "}";
            } else if (c === '"') {
                str += '\\"';
            } else {
                str += c;
            }
        });
        return '"' + str + '"';
    },
    
    to_string: function (v, quote_string) {
        switch (v.type) {
        case "null":
            return runtime.string("null");
        case "boolean":
            return runtime.string(String(v.value));
        case "number":
            return runtime.string(big_float.string(v.value));
        case "string":
            if (quote_string) {
                return runtime.string(runtime.quote(v.value));
            } else {
                return v;
            }
        case "array":
            var str = "[";
            v.value.forEach(function (item) {
                if (str.length > 1) {
                    str += ", ";
                }
                str += runtime.to_string(item, true).value;
            });
            return runtime.string(str + "]");
        case "record":
            var str = "{";
            // console.log(Array.from(v.value.entries()))
            Array.from(v.value.entries()).forEach(function (item) {
                if (str.length > 1) {
                    str += ", ";
                }
                var key = item[0];
                var value = item[1];
                // console.log("%val", item[2]);
                if (key.match(/^[a-z](_?[a-zA-Z0-9]*)*$/g)) {
                    str += key + ": ";
                } else {
                    str += runtime.quote(key) + ": ";
                }
                str += runtime.to_string(value, true).value;
            });
            return runtime.string(str + "}");
        case "function":
            return runtime.string("(fn " + v.params.join("") + ")");
        }
    },
    
    concat: function (v1, v2) {
        v1 = runtime.to_string(v1);
        v2 = runtime.to_string(v2);
        return runtime.string(v1.value + v2.value);
    },
    
    equals: function (v1, v2) {
        if (v1.type !== v2.type) {
            return runtime.boolean(false);
        }
        switch (v1.type) {
        case "null":
        case "boolean":
        case "string":
            return runtime.boolean(v1.value === v2.value);
        case "number":
            return runtime.boolean(big_float.eq(v1.value, v2.value));
        case "array":
            if (v1.value.count() !== v2.value.count()) {
                return runtime.boolean(false);
            }
            var size = v1.value.count();
            var i;
            for (i = 0; i < size; i += 1) {
                if (!runtime.equals(v1.value.get(i), v2.value.get(i)).value) {
                    return runtime.boolean(false);
                }
            }
            return runtime.boolean(true);
        case "record":
            if (v1.value.count() !== v2.value.count()) {
                return runtime.boolean(false);
            }
            var size = v1.value.count();
            var sorted_v1 = v1.value.sortBy(function (v, k) { return k; }, function (a, b) {
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    return 0;
                }
            });
            var sorted_v2 = v2.value.sortBy(function (v, k) { return k; }, function (a, b) {
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    return 0;
                }
            });
            var entries_v1 = Array.from(sorted_v1.entries());
            var entries_v2 = Array.from(sorted_v2.entries());
            
            var i;
            for (i = 0; i < size; i += 1) {
                // console.log(entries_v1.get(i)[1], entries_v2.get(i)[1])
                if (!(entries_v1[i][0] === entries_v2.get[i][0] && runtime.equals(entries_v1.get[i][1], entries_v2.get[i][1]).value)) {
                    return runtime.boolean(false);
                }
            }
            return runtime.boolean(true);
        case "function":
            return v1.value === v2.value;
        }
    },
    not: function (v) {
        if (v.type !== "boolean") {
            return runtime.fail("Type error");
        }
        return runtime.boolean(!v.value);
    },
    lt: function (v1, v2) {
        if (v1.type === "number" && v2.type === "number") {
            return runtime.boolean(big_float.lt(v1.value, v2.value));
        }
        if (v1.type === "string" && v2.type === "string") {
            return runtime.boolean(v1.value < v2.value);
        }
        return runtime.fail("Type error");
    },
    ge: function (v1, v2) {
        return runtime.not(runtime.lt(v1, v2));
    },
    gt: function (v1, v2) {
        return runtime.lt(v2, v1);
    },
    le: function (v1, v2) {
        return runtime.not(runtime.gt(v1, v2));
    },
    neg: function (v) {
        if (v.type !== "number") {
            runtime.fail("Type error");
        }
        var n = runtime.number(0);
        n.value = big_float.neg(v.value);
        return n;
    },
    plus: function (v) {
        if (v.type !== "number") {
            runtime.fail("Type error");
        }
        return v;
    },
    add: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        var result = big_float.add(v1.value, v2.value);
        if (!isFinite(result)) {
            return runtime.null(s);
        }
        return runtime.number(result);
    },
    sub: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        var result = big_float.sub(v1.value, v2.value);
        if (!isFinite(result)) {
            return runtime.fail("Arithmetic error");
        }
        return runtime.number(result);
    },
    mul: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        var result = big_float.mul(v1.value, v2.value);
        if (!isFinite(result)) {
            return runtime.fail("Arithmetic error");
        }
        return runtime.number(result);
    },
    div: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        var result = big_float.div(v1.value, v2.value);
        if (!isFinite(result)) {
            return runtime.fail("Arithmetic error");
        }
        return runtime.number(result);
    },
    mod: function (v1, v2) {
        return runtime.number(
            big_float.sub(
                v1.value,
                big_float.mul(
                    v2.value,
                    big_float.floor(big_float.div(v1.value, v2.value))
                )
            )
        );
    },
    get: function (v, key) {
        if (v.type !== "string" && v.type !== "array" && v.type !== "record") {
            return runtime.fail("Type error.");
        }
        switch (v.type) {
        case "string":
            if (key.type !== "number") {
                return runtime.fail("Index must be a number");
            }
            if (!big_float.is_integer(key.value)) {
                return runtime.fail("Index must be an integer");
            }
            if (big_float.is_negative(key.value)) {
                return runtime.fail("Index cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.length) {
                return runtime.fail("Index out of range");
            }
            return runtime.number(v.value.charCodeAt(index));
        case "array":
            if (key.type !== "number") {
                return runtime.fail("Index must be a number");
            }
            if (!big_float.is_integer(key.value)) {
                return runtime.fail("Index must be an integer");
            }
            if (big_float.is_negative(key.value)) {
                return runtime.fail("Index cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.count()) {
                return runtime.fail("Index out of range");
            }
            return v.value.get(index);
        case "record":
            var str_key = runtime.to_string(key).value;
            var found_value = v.value.get(str_key);
            if (!found_value) {
                return runtime.null();
            }
            return found_value;
        default:
            return runtime.fail("Type error.");
        }
    },
    push: function (v, val) {
        if (v.type !== "array") {
            return runtime.fail("Must be an array");
        }
        var new_array = runtime.array();
        new_array.value = v.value.push(val);
        return new_array;
    },
    set: function (v, key, new_val) {
        switch (v.type) {
        case "string":
            if (key.type !== "number") {
                return runtime.fail("Index must be a number");
            }
            if (!big_float.is_integer(key.value)) {
                return runtime.fail("Index must be an integer");
            }
            if (big_float.is_negative(key.value)) {
                return runtime.fail("Index cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.length) {
                return runtime.fail("Index out of range");
            }
            if (new_val.type !== "number") {
                return runtime.fail("Char must be a number");
            }
            if (!big_float.is_integer(new_val.value)) {
                return runtime.fail("Char must be an integer");
            }
            if (big_float.is_negative(new_val.value)) {
                return runtime.fail("Char cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.length) {
                return runtime.fail("Index out of range");
            }
            var new_val_js = new_val.value;
            if (new_val_js > 0xffff) {
                return runtime.fail("Char cannot be greater than " + String(0xffff));
            }
            
            var str = v.value;
            var new_str = str.substr(0, index) + String.fromCharCode(new_val_js) + str.substr(index + 1);
            
            return runtime.string(new_str);
        case "array":
            
        case "record":
            
        default:
            return runtime.fail("Type error.");
        }
    },
    range: function (from, to) {
        if (from.type !== "number") {
            return runtime.fail("Must be a number");
        }
        if (!big_float.is_integer(from.value)) {
            return runtime.fail("Must be an integer");
        }
        if (to.type !== "number") {
            return runtime.fail("Must be a number");
        }
        if (!big_float.is_integer(to.value)) {
            return runtime.fail("Must be an integer");
        }
        var a = Number(runtime.to_string(from).value);
        var b = Number(runtime.to_string(to).value);
        var arr = [];
        var incr_by = 1;
        if (b < a) {
            incr_by = -1;
        }
        var len = Math.abs(b - a);
        if (len > 1000000) {
            return runtime.fail("Range is too large to be represented");
        }
        var current = a;
        if (len > 0) {
            while (true) {
                arr.push(a);
                if (arr.length === len) {
                    break;
                }
                a += incr_by;
            }
        }
        return runtime.from_js(arr);
    },
    call: function (f, args) {
        if (f.type !== "function") {
            return runtime.fail("Not a function");
        }
        return f.value.apply(null, args);
    },
    ensure_boolean: function (v, not_js_bool) {
        if (v.type !== "boolean") {
            return runtime.fail("Not boolean");
        }
        if (not_js_bool) {
            return v;
        }
        return v.value;
    },
    catch: function (f) {
        var result;
        var error;
        try {
            result = f();
        } catch (e) {
            error = e;
        }
        return runtime.record([
            ['error', error || runtime.null()],
            ['value', result || runtime.null()],
        ]);
    },
    iterator: function (v) {
        if (v.type !== "string" && v.type !== "array" && v.type !== "record") {
            return runtime.fail("Not iterable");
        }
        var i = 0;
        var len = v.type === "string" ? v.value.length : v.value.count();
        var entry_seq;
        if (v.type === "record") {
            entry_seq = Array.from(v.value.entries());
        }
        return {
            next: function () {
                var next;
                switch (v.type) {
                case "string":
                    next = runtime.number(v.value.charCodeAt(i));
                    break;
                case "array":
                    next = v.value.get(i);
                    break;
                case "record":
                    var entry = entry_seq[i];
                    next = runtime.record([
                        ['key', runtime.string(entry[0])],
                        ['value', entry[1]]
                    ]);
                    break;
                }
                i += 1;
                return next;
            },
            has_next: function () {
                return i < len;
            }
        }
    }
};

module.exports = runtime;

