import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? '',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

let onUnauthorized = null;

export function setUnauthorizedHandler(fn) {
    onUnauthorized = fn;
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            onUnauthorized?.();
        }
        return Promise.reject(error);
    }
);

export default api;