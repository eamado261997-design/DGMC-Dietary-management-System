async function run() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData.user ? 'success' : loginData);

  if (loginData.token) {
    const schedRes = await fetch('http://localhost:3000/api/manager/employee-schedules', {
      headers: { 'Authorization': 'Bearer ' + loginData.token }
    });
    const text = await schedRes.text();
    console.log('Sched:', text);
  }
}
run();
