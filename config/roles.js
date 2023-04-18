var roles = {

    "/authentication/password": ["Admin", "Superuser", "User", "Guest"],
    "/authentication/refresh": ["Admin", "Superuser", "User", "Guest"],
    "/authentication/check": ["Admin", "Superuser", "User", "Guest"],
    "/authentication/logout": ["Admin", "Superuser", "User", "Guest"],

    "/users/insert": ["Admin", "Superuser"],
    "/users/view(/:id)?": ["Admin", "Superuser", "User"],
    "/users/profile": ["Admin", "Superuser", "User"],
    "/users/picture": ["Admin", "Superuser", "User"],
    "/users/update/:id": ["Admin", "Superuser"],
    "/users/delete/:id": ["Admin", "Superuser"],
    "/users/colleagues": ["Admin", "Superuser", "User"],
    "/users/dashboard": ["Admin", "Superuser", "User"],
    "/users": ["Admin", "Superuser"],

    "/meetings/upload": ["Admin", "Superuser", "User"],
    "/meetings/insert": ["Admin", "Superuser", "User"],
    "/meetings/view/:id": ["Admin", "Superuser", "User"],
    "/meetings/update/:id": ["Admin", "Superuser", "User"],
    "/meetings/restore/:id": ["Admin", "Superuser", "User"],
    "/meetings/cancel/:id": ["Admin", "Superuser", "User"],
    "/meetings/invite/:id/:method": ["Admin", "Superuser", "User"],
    "/meetings/start/:id": ["Admin", "Superuser", "User"],
    "/meetings/validate/:code": ["Admin", "Superuser", "User"],
    "/meetings": ["Admin", "Superuser", "User"],

    "/ideations/insert": ["Admin", "Superuser", "User"],
    "/ideations/view/:id": ["Admin", "Superuser", "User"],
    "/ideations/update/:id": ["Admin", "Superuser", "User"],
    "/ideations/delete/:id": ["Admin", "Superuser", "User"],
    "/ideations": ["Admin", "Superuser", "User"],

    "/projects/insert": ["Admin", "Superuser"],
    "/projects/view/:id": ["Admin", "Superuser"],
    "/projects/update/:id": ["Admin", "Superuser"],
    "/projects/delete/:id": ["Admin", "Superuser"],
    "/projects/member": ["Admin", "Superuser", "User"],
    "/projects": ["Admin", "Superuser"],

    "/tasks/upload": ["Admin", "Superuser", "User"],
    "/tasks/insert/:project": ["Admin", "Superuser", "User"],
    "/tasks/view/:id": ["Admin", "Superuser", "user"], //TODO
    "/tasks/update/:project/:id": ["Admin", "Superuser", "User"],
    "/tasks/delete/:project/:id": ["Admin", "Superuser", "User"],
    "/tasks/:project": ["Admin", "Superuser", "User"],

    "/companies/view/:id": ["Admin"],
    "/companies(/:page)?(/:item_per_page)?(/:sort_order)?(/:sort_field)?(/:keyword)?": ["Admin"],
}


module.exports = roles