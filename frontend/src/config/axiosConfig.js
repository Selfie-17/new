import axios from "axios";

// In production (same server), use relative URL. In dev, use the env variable.
const baseURL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

const instance = axios.create({
    baseURL,
    withCredentials: true,
});

export default instance;

