var code_box = document.getElementById('code');
var myCodeMirror = CodeMirror.fromTextArea(code_box,{
    stylesheet: "css/pythoncolors.css",
    textWrapping: false,
    lineNumbers: true,
    styleActiveLine: true,
    indentUnit: 4,
    parserConfig: {'pythonVersion': 2, 'strictErrors': true}
});



  var jsrepl = new JSREPL({
    input: function(){},
    output: function(data){console.log(data);},
    result: function(data){document.getElementById('result').innerHTML = 'Resultado de aplicar cuadrado(34) : '+data;
    var paso = 'Negativa';
    if(data == '1156')
        paso = 'Positiva';
    document.getElementById('expected').innerHTML = 'Evaluacion: '+paso;




    },
    timeout: {
      time: 30000,
      callback: function(){console.log("Se te paso el tiempo")}
    }
  });


jsrepl.loadLanguage('python', function () {
    console.log('Python loaded');
});
function evaluateCode(){
    console.log(document.getElementById("code").value);
jsrepl.eval(myCodeMirror.getValue());
jsrepl.eval('cuadrado(34)');
}
