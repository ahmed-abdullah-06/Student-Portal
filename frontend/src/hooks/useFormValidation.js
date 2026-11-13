import { useState, useEffect, useRef } from 'react';

export default function useFormValidation(initialValues, validationRules) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const isValid = Object.keys(errors).length === 0;

  const handleChange = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (validationRules[field]) {
      const error = validationRules[field](value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[field] = error;
        } else {
          delete newErrors[field];
        }
        return newErrors;
      });
    }
  };

  const handleSubmit = (onSubmit) => (event) => {
    event.preventDefault();

    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    const formErrors = {};
    let hasErrors = false;

    Object.entries(validationRules).forEach(([field, validator]) => {
      const error = validator(values[field]);
      if (error) {
        formErrors[field] = error;
        hasErrors = true;
      }
    });

    setErrors(formErrors);

    if (!hasErrors && onSubmit) {
      onSubmit(values);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleSubmit,
    reset,
    setValues,
  };
}
