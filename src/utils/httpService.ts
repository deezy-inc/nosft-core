import axios, { AxiosInstance } from 'axios';

/**
 * @description service to call HTTP request via Axios
 */
class ApiService {
    /**
     * @description property to share axios _instance
     */
    public _instance: AxiosInstance;

    /**
     * @description initialize vue axios
     */
    constructor(baseURL: string) {
        this._instance = axios.create({
            baseURL,
            headers: {
                'Content-type': 'application/json',
            },
        });
    }

    /**
     * @description set the default HTTP request headers
     */
    public setHeader(key: string, value: string): void {
        this._instance.defaults.headers.common[key] = value;
    }

    /**
     * @description send the GET HTTP request
     * @param resource: string
     * @param params: AxiosRequestConfig
     * @returns Promise<AxiosResponse>
     */
    public async query<T>(resource: string, params: any): Promise<T> {
        const result = await this._instance.get(resource, params);
        return result.data as T;
    }

    /**
     * @description send the GET HTTP request
     * @param resource: string
     * @param slug: string
     * @returns Promise<AxiosResponse>
     */
    public async get<T>(resource: string, slug = '' as string): Promise<T> {
        const result = await this._instance.get(`${resource}/${slug}`);
        return result.data as T;
    }

    /**
     * @description set the POST HTTP request
     * @param resource: string
     * @param params: AxiosRequestConfig
     * @returns Promise<AxiosResponse>
     */
    public async post<T>(resource: string, params: any): Promise<T> {
        const result = await this._instance.post(`${resource}`, params);
        return result.data as T;
    }

    /**
     * @description send the UPDATE HTTP request
     * @param resource: string
     * @param slug: string
     * @param params: AxiosRequestConfig
     * @returns Promise<AxiosResponse>
     */
    public async update<T>(resource: string, slug: string, params: any): Promise<T> {
        const result = await this._instance.put(`${resource}/${slug}`, params);
        return result.data as T;
    }

    /**
     * @description Send the PUT HTTP request
     * @param resource: string
     * @param params: AxiosRequestConfig
     * @returns Promise<AxiosResponse>
     */
    public async put<T>(resource: string, params: any): Promise<T> {
        const result = await this._instance.put(`${resource}`, params);
        return result.data as T;
    }

    /**
     * @description Send the DELETE HTTP request
     * @param resource: string
     * @returns Promise<AxiosResponse>
     */
    public delete(resource: string): Promise<void> {
        return this._instance.delete(resource);
    }
}

export default ApiService;
