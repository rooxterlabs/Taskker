import React from 'react';

// A simple gatekeeper component that conditionally renders its children
// based on whether the `userRole` is included in the `allowed` array.

export default function RoleGate({ userRole, allowed, children }) {
    // Treat super_admin as root - always has access
    if (userRole === 'super_admin') {
        return <>{children}</>;
    }

    if (allowed.includes(userRole)) {
        return <>{children}</>;
    }

    // Role not permitted, render nothing
    return null;
}
