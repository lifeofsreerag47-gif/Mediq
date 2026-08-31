function applySavedTheme() {
    const theme = localStorage.getItem("theme");

    if (theme === "dark") {
        document.documentElement.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
    }
}

applySavedTheme();