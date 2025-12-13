import axios from "axios";

// Use the environment variable for API URL, fallback to localhost for dev
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const instance = axios.create({
    baseURL,
    withCredentials: true,
});

export default instance;

