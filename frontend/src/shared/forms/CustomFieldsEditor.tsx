import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { MAX_CUSTOM_FIELDS, type CustomFieldRow } from './customFields'
import styles from './CustomFieldsEditor.module.css'

/** Any form that has a `custom_fields` list of rows. */
interface WithCustomFields {
  custom_fields: CustomFieldRow[]
}

interface CustomFieldsEditorProps<T extends WithCustomFields> {
  control: Control<T>
  register: UseFormRegister<T>
  errors: FieldErrors<WithCustomFields>['custom_fields']
}

/**
 * Add, edit and delete custom fields (RF-27). Removing a row deletes that field in Wialon,
 * because the whole set is sent on save.
 */
export function CustomFieldsEditor<T extends WithCustomFields>(props: CustomFieldsEditorProps<T>) {
  // The driver and passenger forms have more fields; this component only touches
  // `custom_fields`, which both are guaranteed to have (T extends WithCustomFields).
  const control = props.control as unknown as Control<WithCustomFields>
  const register = props.register as unknown as UseFormRegister<WithCustomFields>
  const { errors } = props
  const { fields, append, remove } = useFieldArray({ control, name: 'custom_fields' })

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Campos personalizados</legend>
      {fields.length === 0 && <p className={styles.empty}>No tiene campos personalizados.</p>}
      <ul className={styles.rows}>
        {fields.map((field, index) => (
          <li key={field.id} className={styles.row}>
            <TextField
              label={`Nombre del campo ${index + 1}`}
              error={errors?.[index]?.name?.message}
              {...register(`custom_fields.${index}.name`)}
            />
            <TextField
              label={`Valor del campo ${index + 1}`}
              error={errors?.[index]?.value?.message}
              {...register(`custom_fields.${index}.value`)}
            />
            <Button
              variant="ghost"
              className={styles.remove}
              aria-label={`Quitar campo ${index + 1}`}
              onClick={() => remove(index)}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      {errors?.root?.message && <p className={styles.error}>{errors.root.message}</p>}
      <Button
        variant="secondary"
        disabled={fields.length >= MAX_CUSTOM_FIELDS}
        onClick={() => append({ name: '', value: '' })}
      >
        Agregar campo
      </Button>
    </fieldset>
  )
}
