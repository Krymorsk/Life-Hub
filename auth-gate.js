(function(){
  const path = location.pathname.split("/").pop() || "index.html";
  const isApp = path === "" || path === "index.html";
  const hasSession = localStorage.getItem("lifehub_auth_completed") === "1";
  if (isApp && !hasSession) {
    location.replace("login.html");
  }
})();