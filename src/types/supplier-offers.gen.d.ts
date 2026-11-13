import type {
  OpenAPIClient,
  Parameters,
  UnknownParamsObject,
  OperationResponse,
  AxiosRequestConfig,
} from 'openapi-client-axios';

declare namespace Components {
    namespace Schemas {
        export interface ErrorResponse {
            /**
             * example:
             * NOT_FOUND
             */
            error: string;
            /**
             * example:
             * Offer with ID off-999 not found
             */
            message: string;
        }
        export interface Offer {
            /**
             * example:
             * off-101
             */
            id: string;
            /**
             * example:
             * supp-100
             */
            supplier_id: string;
            /**
             * example:
             * 5-Axis CNC Milling Center VMC-850
             */
            title: string;
            /**
             * example:
             * High-precision vertical machining center for aerospace and automotive parts.
             */
            description?: string;
            /**
             * example:
             * ACTIVE
             */
            status: "ACTIVE" | "INACTIVE" | "DRAFT";
            /**
             * example:
             * 89500
             */
            price: number;
            /**
             * example:
             * EUR
             */
            currency: string;
            /**
             * example:
             * 2026-10-15T09:30:00Z
             */
            updated_at: string; // date-time
        }
        export interface OfferListResponse {
            items: {
                /**
                 * example:
                 * off-101
                 */
                id: string;
                /**
                 * example:
                 * supp-100
                 */
                supplier_id: string;
                /**
                 * example:
                 * 5-Axis CNC Milling Center VMC-850
                 */
                title: string;
                /**
                 * example:
                 * High-precision vertical machining center for aerospace and automotive parts.
                 */
                description?: string;
                /**
                 * example:
                 * ACTIVE
                 */
                status: "ACTIVE" | "INACTIVE" | "DRAFT";
                /**
                 * example:
                 * 89500
                 */
                price: number;
                /**
                 * example:
                 * EUR
                 */
                currency: string;
                /**
                 * example:
                 * 2026-10-15T09:30:00Z
                 */
                updated_at: string; // date-time
            }[];
            /**
             * example:
             * 3
             */
            total: number;
            /**
             * example:
             * 1
             */
            page: number;
            /**
             * example:
             * 20
             */
            size: number;
        }
    }
}
declare namespace Paths {
    namespace GetOffer {
        namespace Parameters {
            export type OfferId = string;
        }
        export interface PathParameters {
            offer_id: Parameters.OfferId;
        }
        namespace Responses {
            export interface $200 {
                /**
                 * example:
                 * off-101
                 */
                id: string;
                /**
                 * example:
                 * supp-100
                 */
                supplier_id: string;
                /**
                 * example:
                 * 5-Axis CNC Milling Center VMC-850
                 */
                title: string;
                /**
                 * example:
                 * High-precision vertical machining center for aerospace and automotive parts.
                 */
                description?: string;
                /**
                 * example:
                 * ACTIVE
                 */
                status: "ACTIVE" | "INACTIVE" | "DRAFT";
                /**
                 * example:
                 * 89500
                 */
                price: number;
                /**
                 * example:
                 * EUR
                 */
                currency: string;
                /**
                 * example:
                 * 2026-10-15T09:30:00Z
                 */
                updated_at: string; // date-time
            }
            export interface $401 {
                /**
                 * example:
                 * NOT_FOUND
                 */
                error: string;
                /**
                 * example:
                 * Offer with ID off-999 not found
                 */
                message: string;
            }
            export interface $404 {
                /**
                 * example:
                 * NOT_FOUND
                 */
                error: string;
                /**
                 * example:
                 * Offer with ID off-999 not found
                 */
                message: string;
            }
        }
    }
    namespace ListOffers {
        namespace Parameters {
            export type Page = number;
            export type Size = number;
            export type Status = "ACTIVE" | "INACTIVE" | "DRAFT";
            export type SupplierId = string;
        }
        export interface QueryParameters {
            supplier_id?: Parameters.SupplierId;
            status?: Parameters.Status;
            page?: Parameters.Page;
            size?: Parameters.Size;
        }
        namespace Responses {
            export interface $200 {
                items: {
                    /**
                     * example:
                     * off-101
                     */
                    id: string;
                    /**
                     * example:
                     * supp-100
                     */
                    supplier_id: string;
                    /**
                     * example:
                     * 5-Axis CNC Milling Center VMC-850
                     */
                    title: string;
                    /**
                     * example:
                     * High-precision vertical machining center for aerospace and automotive parts.
                     */
                    description?: string;
                    /**
                     * example:
                     * ACTIVE
                     */
                    status: "ACTIVE" | "INACTIVE" | "DRAFT";
                    /**
                     * example:
                     * 89500
                     */
                    price: number;
                    /**
                     * example:
                     * EUR
                     */
                    currency: string;
                    /**
                     * example:
                     * 2026-10-15T09:30:00Z
                     */
                    updated_at: string; // date-time
                }[];
                /**
                 * example:
                 * 3
                 */
                total: number;
                /**
                 * example:
                 * 1
                 */
                page: number;
                /**
                 * example:
                 * 20
                 */
                size: number;
            }
            export interface $401 {
                /**
                 * example:
                 * NOT_FOUND
                 */
                error: string;
                /**
                 * example:
                 * Offer with ID off-999 not found
                 */
                message: string;
            }
        }
    }
}


export interface OperationMethods {
  /**
   * listOffers - List supplier offers
   * 
   * Returns a paginated list of offers, optionally filtered by supplier_id and status.
   */
  'listOffers'(
    parameters?: Parameters<Paths.ListOffers.QueryParameters> | null,
    data?: any,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ListOffers.Responses.$200>
  /**
   * getOffer - Get offer by ID
   * 
   * Retrieves detailed information for a single offer by its unique offer_id.
   */
  'getOffer'(
    parameters?: Parameters<Paths.GetOffer.PathParameters> | null,
    data?: any,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.GetOffer.Responses.$200>
}

export interface PathsDictionary {
  ['/s2s/v1/offers']: {
    /**
     * listOffers - List supplier offers
     * 
     * Returns a paginated list of offers, optionally filtered by supplier_id and status.
     */
    'get'(
      parameters?: Parameters<Paths.ListOffers.QueryParameters> | null,
      data?: any,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ListOffers.Responses.$200>
  }
  ['/s2s/v1/offers/{offer_id}']: {
    /**
     * getOffer - Get offer by ID
     * 
     * Retrieves detailed information for a single offer by its unique offer_id.
     */
    'get'(
      parameters?: Parameters<Paths.GetOffer.PathParameters> | null,
      data?: any,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.GetOffer.Responses.$200>
  }
}

export type Client = OpenAPIClient<OperationMethods, PathsDictionary>


export type ErrorResponse = Components.Schemas.ErrorResponse;
export type Offer = Components.Schemas.Offer;
export type OfferListResponse = Components.Schemas.OfferListResponse;
