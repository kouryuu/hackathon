(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      var Kaffeine;
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.inspect = this.sandbox.console.inspect;
      this.functionClass = this.sandbox.Function;
      this.sandbox.__eval = this.sandbox["eval"];
      this.tokenizer = this.sandbox.require('kaffeine/token');
      Kaffeine = this.sandbox.require('kaffeine');
      this.kaffeine = new Kaffeine;
      ready();
    }

    JSREPLEngine.prototype.Compile = function(command) {
      var e, js;
      js = this.kaffeine.compile(command);
      try {
        new this.functionClass(js);
      } catch (_error) {
        e = _error;
        js = "(" + js + ")";
      }
      return js;
    };

    JSREPLEngine.prototype.Eval = function(command) {
      var e, js, result;
      try {
        js = this.Compile(command);
      } catch (_error) {
        e = _error;
        e.message = 'Compiling: ' + e.message;
        this.error(e);
        return;
      }
      try {
        result = this.sandbox.__eval(js);
        return this.result(result === void 0 ? '' : this.inspect(result));
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      return this.sandbox.__eval(this.Compile(command));
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var e, js, last_line, token;
      try {
        token = this.tokenizer.ize(command);
        while (token != null) {
          if (token.bang) {
            return 0;
          }
          token = token.next;
        }
      } catch (_error) {
        e = _error;
        return 1;
      }
      try {
        js = this.kaffeine.compile(command);
        try {
          new this.functionClass(js);
        } catch (_error) {
          e = _error;
          js = "(" + js + ")";
          new this.functionClass(js);
        }
        last_line = command.split('\n').slice(-1)[0];
        if (/^\s+/.test(last_line)) {
          return 0;
        } else {
          return false;
        }
      } catch (_error) {
        e = _error;
        if (/^\s*(for|while|if|else)\b|[\[\{\(]$/.test(command)) {
          return 1;
        } else {
          return 0;
        }
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
