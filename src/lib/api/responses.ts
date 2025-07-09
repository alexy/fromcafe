import { NextResponse } from 'next/server'

// Standard response types
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
}

export interface ErrorResponse {
  success: false
  error: string
  details?: unknown
}

export interface PaginatedResponse<T = unknown> extends SuccessResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Create a success response
 */
export function successResponse<T = unknown>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data
  }
  if (message) {
    response.message = message
  }
  return NextResponse.json(response, { status })
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status: number = 400,
  details?: unknown
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    success: false,
    error
  }
  if (details) {
    response.details = details
  }
  return NextResponse.json(response, { status })
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T = unknown>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
  },
  message?: string,
  status: number = 200
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(pagination.total / pagination.limit)
  
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  }
  if (message) {
    response.message = message
  }
  return NextResponse.json(response, { status })
}

/**
 * Common success responses
 */
export const responses = {
  // Success responses
  ok: <T>(data: T) => successResponse(data),
  created: <T>(data: T) => successResponse(data, 'Resource created successfully', 201),
  updated: <T>(data: T) => successResponse(data, 'Resource updated successfully'),
  deleted: () => successResponse(null, 'Resource deleted successfully'),
  
  // Error responses
  badRequest: (message: string = 'Bad request') => errorResponse(message, 400),
  unauthorized: (message: string = 'Authentication required') => errorResponse(message, 401),
  forbidden: (message: string = 'Access denied') => errorResponse(message, 403),
  notFound: (message: string = 'Resource not found') => errorResponse(message, 404),
  conflict: (message: string = 'Resource already exists') => errorResponse(message, 409),
  unprocessable: (message: string = 'Validation failed') => errorResponse(message, 422),
  serverError: (message: string = 'Internal server error') => errorResponse(message, 500),
  
  // Specific business logic errors
  blogNotFound: () => errorResponse('Blog not found', 404),
  postNotFound: () => errorResponse('Post not found', 404),
  userNotFound: () => errorResponse('User not found', 404),
  invalidCredentials: () => errorResponse('Invalid credentials', 401),
  blogOwnershipRequired: () => errorResponse('You do not own this blog', 403),
  adminRequired: () => errorResponse('Admin access required', 403)
}

/**
 * Parse request parameters safely
 */
export async function parseRequestParams<T = unknown>(
  request: Request,
  schema?: (data: unknown) => T
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ErrorResponse> }> {
  try {
    const data = await request.json()
    
    if (schema) {
      try {
        const validatedData = schema(data)
        return { data: validatedData, error: null }
      } catch (validationError) {
        return {
          data: null,
          error: responses.unprocessable(
            validationError instanceof Error ? validationError.message : 'Validation failed'
          )
        }
      }
    }
    
    return { data, error: null }
  } catch {
    return {
      data: null,
      error: responses.badRequest('Invalid JSON in request body')
    }
  }
}

/**
 * Parse URL search parameters with defaults
 */
export function parseUrlParams(url: string) {
  const searchParams = new URL(url).searchParams
  
  return {
    getString: (key: string, defaultValue: string = '') => 
      searchParams.get(key) || defaultValue,
    
    getNumber: (key: string, defaultValue: number = 0) => {
      const value = searchParams.get(key)
      return value ? parseInt(value, 10) || defaultValue : defaultValue
    },
    
    getBoolean: (key: string, defaultValue: boolean = false) => {
      const value = searchParams.get(key)
      return value ? value === 'true' : defaultValue
    },
    
    getPagination: (defaultLimit: number = 10) => {
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || defaultLimit.toString(), 10)))
      const offset = (page - 1) * limit
      
      return { page, limit, offset }
    }
  }
}