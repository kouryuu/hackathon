(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.input = input;
      this.output = output;
      this.error = error;
      this.sandbox = sandbox;
      this.result_fn_factory = function(result_fn) {
        return function(env) {
          var len, list, listName, listStr, result_env;
          result_env = '';
          for (listName in env) {
            list = env[listName];
            listStr = list.toString();
            len = listStr.length - 74;
            len = len > 0 ? len : 0;
            listStr = listStr.slice(len);
            if (len > 0) {
              listStr = '...' + listStr;
            }
            result_env += ("\n" + listName + ": ") + listStr;
          }
          return result_fn(result_env);
        };
      };
      this.result_handler = this.result_fn_factory(result);
      this.interpreter = new this.sandbox.Emoticon.Interpreter({
        source: [],
        input: this.input,
        print: this.output,
        result: this.result_handler
      });
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var code, e;
      try {
        if (command.match(/^RESET\b/)) {
          this.interpreter = new this.sandbox.Emoticon.Interpreter({
            source: [],
            input: this.input,
            print: this.output,
            result: this.result_handler
          });
          command = command.replace(/^RESET/, '');
        }
        code = new this.sandbox.Emoticon.Parser(command);
        this.interpreter.lists.Z = this.interpreter.lists.Z.concat(code);
        return this.interpreter.run();
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var code, ret;
      code = new this.sandbox.Emoticon.Parser(command);
      this.interpreter.lists.Z = this.interpreter.lists.Z.concat(code);
      ret = null;
      this.interpreter.result = this.result_fn_factory(function(res) {
        return ret = res;
      });
      this.interpreter.run();
      this.interpreter.result = this.result_handler;
      return ret;
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var countParens, parens_in_last_line;
      countParens = (function(_this) {
        return function(str) {
          var parens, token, tokens, _i, _len;
          tokens = new _this.sandbox.Emoticon.Parser(str);
          parens = 0;
          for (_i = 0, _len = tokens.length; _i < _len; _i++) {
            token = tokens[_i];
            if (token.mouth) {
              switch (token.mouth) {
                case '(':
                  ++parens;
                  break;
                case ')':
                  --parens;
              }
            }
          }
          return parens;
        };
      })(this);
      if (countParens(command) <= 0) {
        return false;
      } else {
        parens_in_last_line = countParens(command.split('\n').slice(-1)[0]);
        if (parens_in_last_line > 0) {
          return 1;
        } else if (parens_in_last_line < 0) {
          return parens_in_last_line;
        } else {
          return 0;
        }
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
