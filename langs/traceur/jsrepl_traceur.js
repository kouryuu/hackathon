(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.inspect = this.sandbox.console.inspect;
      this.sandbox.__eval = this.sandbox["eval"];
      this.traceur = this.sandbox.traceur;
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e, result, source;
      try {
        source = this._Compile(command);
      } catch (_error) {
        e = _error;
        this.error(e);
        return;
      }
      try {
        result = this.sandbox.__eval(source);
        return this.result(result === void 0 ? '' : this.inspect(result));
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var e, last_line;
      try {
        this._Compile(command);
        last_line = command.split('\n').slice(-1)[0];
        if (/^\s+/.test(last_line)) {
          return 0;
        } else {
          return false;
        }
      } catch (_error) {
        e = _error;
        if (/[\[\{\(]$/.test(command)) {
          return 1;
        } else {
          return 0;
        }
      }
    };

    JSREPLEngine.prototype._Compile = function(command) {
      var errors, project, reporter, res;
      errors = [];
      reporter = new this.traceur.util.ErrorReporter;
      reporter.reportMessageInternal = function(location, kind, format, args) {
        var i, message;
        i = 0;
        message = format.replace(/%s/g, function() {
          return args[i++];
        });
        return errors.push(location ? "" + location + ": " + message : message);
      };
      project = new this.traceur.semantics.symbols.Project;
      project.addFile(new this.traceur.syntax.SourceFile('REPL', command));
      res = this.traceur.codegeneration.Compiler.compile(reporter, project, false);
      if (reporter.hadError()) {
        throw new Error(errors.join('\n'));
      } else {
        return this.traceur.codegeneration.ProjectWriter.write(res);
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
