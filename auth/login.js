document.getElementById('togglePw').addEventListener('click', function () {
  var p = document.getElementById('password');
  var o = document.getElementById('eyeOpen');
  var c = document.getElementById('eyeClosed');
  if (p.type === 'password') {
    p.type = 'text';
    o.style.display = 'none';
    c.style.display = 'block';
  } else {
    p.type = 'password';
    o.style.display = 'block';
    c.style.display = 'none';
  }
});
