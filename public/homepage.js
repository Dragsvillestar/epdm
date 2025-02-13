const logOutButton = document.getElementById("logOut");

logOutButton.addEventListener("click", () => {
    fetch("/logout", { method: "GET" })
    .then(response => {
        if (response.ok) {  // Check if the request was successful
            if (response.redirected) {
                window.location.href = response.url; // Redirect to login page
            }
        } else {
            console.error("Logout failed", response.status);
            // You can also show an error message to the user if needed
        }
    })
    .catch(error => {
        console.error("Error during logout:", error);
        // Handle network errors or other issues
    });
});
