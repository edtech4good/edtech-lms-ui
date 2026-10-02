import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller shows a 400's field errors beside the fields
 * (organisation create and update). The error interceptor then does not also
 * toast the 400: a validation failure is never a toast.
 */
export const FIELD_ERRORS_INLINE = new HttpContextToken<boolean>(() => false);
