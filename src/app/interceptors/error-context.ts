import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller shows a 400's field errors beside the fields
 * (organisation create and update). The error interceptor then does not also
 * toast the 400: a validation failure is never a toast.
 */
/**
 * Set on a request whose caller shows EVERY failure itself (a batch upload names each refused file, a network error or
 * a server error included). The error interceptor then shows no notice at all for it, so a failure is one message,
 * never two. (Unlike the tokens above it also covers 429, 500 and an unreachable server; it never touches the
 * redirect on 401 or the blocked page.)
 */
export const FAILURES_SHOWN_BY_CALLER = new HttpContextToken<boolean>(() => false);

export const FIELD_ERRORS_INLINE = new HttpContextToken<boolean>(() => false);

/**
 * Set on a request whose caller says what a 403 means itself (the organisation
 * list and delete, whose 403 means "organisations are for platform staff").
 * The error interceptor's generic "You don't have permission to do that." toast
 * is then not shown as well. FIELD_ERRORS_INLINE implies it: those callers show
 * a 403 beside the form.
 */
export const FORBIDDEN_HANDLED = new HttpContextToken<boolean>(() => false);

/**
 * Set on a request whose caller says what a 404 means itself (the staff edit
 * page, which shows "That person doesn't exist..." instead of a form; the
 * organisation delete, whose list says "It no longer exists."). The error
 * interceptor's generic "That record was not found." toast is then not shown as
 * well. FIELD_ERRORS_INLINE implies it: those callers show a 404 beside the form.
 */
export const NOT_FOUND_HANDLED = new HttpContextToken<boolean>(() => false);
