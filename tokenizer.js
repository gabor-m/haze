function error(str) {
    throw str;
}

/*
TOKENS
    name
        name_Next
    number
        0156.78e-5
    string
        'abc\n\u{ff}'
        "abc\n\u{ff}"
    operator
        { [ && += ~ etc.
*/

function tokenizer(source) {
    var prefix = ":=<>!+-*?&|/%^~.";
    var suffix = ":=<>&|.?";
    
    var c;
    var from;
    var i = 0;
    var length = source.length;
    var n;
    var q;
    var str;
    var hex;

    var result = [];

    var make = function (type, value) {

        return {
            type: type,
            value: value,
            from: from,
            to: i
        };
    };


    if (source.trim() === "") {
        return [];
    }


    c = source.charAt(i);
    while (c) {
        from = i;

        // whitespace

        if (c === ' ' || c === '\r' || c === '\n') {
            i += 1;
            c = source.charAt(i);

        // name

        } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_') {
            str = c;
            i += 1;
            while (true) {
                c = source.charAt(i);
                if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c === '_') {
                    str += c;
                    i += 1;
                } else {
                    break;
                }
            }
            if (str.charAt(0) === '_') {
                error("Name cannot start with _");
            }
            if (str.charAt(str.length - 1) === '_') {
                error("Name cannot end with _");
            }
            if (str.indexOf('__') >= 0) {
                error("Name cannot contain double _");
            }
            result.push(make('name', str));

        // number


        } else if (c >= '0' && c <= '9') {
            str = c;
            i += 1;

            while (true) {
                c = source.charAt(i);
                if (c < '0' || c > '9') {
                    break;
                }
                i += 1;
                str += c;
            }


            if (c === '.') {
                i += 1;
                str += c;
                while (true) {
                    c = source.charAt(i);
                    if (c < '0' || c > '9') {
                        break;
                    }
                    i += 1;
                    str += c;
                }
            }

            if (c === 'e' || c === 'E') {
                i += 1;
                str += c;
                c = source.charAt(i);
                if (c === '-' || c === '+') {
                    i += 1;
                    str += c;
                    c = source.charAt(i);
                }
                if (c < '0' || c > '9') {
                    error("Bad exponent: " + str);
                }
                do {
                    i += 1;
                    str += c;
                    c = source.charAt(i);
                } while (c >= '0' && c <= '9');
            }

            if (c >= 'a' && c <= 'z') {
                str += c;
                i += 1;
                error("Bad number: " + str);
            }

            result.push(make('number', str));

        // string

        } else if (c === '\'' || c === '"') {
            str = '';
            q = c;
            i += 1;
            while (true) {
                c = source.charAt(i);
                if (c < ' ') {
                    error(c === '\n' || c === '\r' || c === ''
                        ? "Unterminated string."
                        : "Control character in string."
                    );
                }
                if (c === q) {
                    break;
                }


                if (c === '\\') {
                    i += 1;
                    if (i >= length) {
                        error("Unterminated string");
                    }
                    c = source.charAt(i);
                    switch (c) {
                    case 'n':
                        c = '\n';
                        break;
                    case 'r':
                        c = '\r';
                        break;
                    case 't':
                        c = '\t';
                        break;
                    case 'u':
                        if (i >= length) {
                            error("Unterminated string");
                        }
                        i += 1;
                        c = source.charAt(i);
                        if (c !== "{") {
                            error("Expected: {");
                        }
                        var hex = "";
                        while (true) {
                            i += 1;
                            c = source.charAt(i);
                            if (c === "}" || c == '') {
                                break;
                            }
                            hex += c;
                        }
                        if (!hex) {
                            error("Missing hex value");
                        }
                        hex = parseInt(hex, 16);
                        if (!isFinite(hex) || hex < 0) {
                            error("Unterminated string");
                        }
                        if (hex >= 0xffff) {
                            error("Char cannot be greater than " + String(0xffff));
                        }
                        c = String.fromCharCode(hex);
                        break;
                    }
                }
                str += c;
                i += 1;
            }
            i += 1;
            result.push(make('string', str));
            c = source.charAt(i);

        // comment

        } else if (c === '/' && source.charAt(i + 1) === '/') {
            i += 1;
            while (true) {
                c = source.charAt(i);
                if (c === '\n' || c === '\r' || c === '') {
                    break;
                }
                i += 1;
            }


        } else if (c === '/' && source.charAt(i + 1) === '*') {
            i += 1;
            while (true) {
                c = source.charAt(i);
                if ((c === '*' && source.charAt(i + 1) === '/') || c == '') {
                    i += 2;
                    c = source.charAt(i);
                    break;
                }
                i += 1;
            }

        } else if (prefix.indexOf(c) >= 0) {
            str = c;
            i += 1;
            while (true) {
                c = source.charAt(i);
                if (i >= length || suffix.indexOf(c) < 0) {
                    break;
                }
                str += c;
                i += 1;
            }
            
            if (str === ":=" && result[result.length - 1] && result[result.length - 1].type === "name") {
                result[result.length - 1].type = "declaration";
                result.push(make('name', result[result.length - 1].value));
                result.push(make('operator', '='));
            } else if (str === "=" && result[result.length - 1] && result[result.length - 2]
                    && result[result.length - 1].value === "]" && result[result.length - 2].value === "[") {
                result.pop();
                result.pop();
                result.push(make('operator', "[]="));
            } else {
                result.push(make('operator', str));
            }


        } else {
            i += 1;
            result.push(make('operator', c));
            c = source.charAt(i);
        }
    }
    // console.log(result)
    return result;
};

module.exports = tokenizer;

