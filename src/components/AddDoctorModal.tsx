import { useState } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Stepper,
  NumberInput,
  Checkbox,
  Select,
  Text
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconUser, IconHeart, IconBriefcase, IconCheck } from '@tabler/icons-react';
import { api } from '@/lib/api';
import styles from './AddDoctorModal.module.css';

interface AddDoctorModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DoctorFormData {
  name: string;
  contact: string;
  address: string;
  birthDate: Date | null;
  isMarried: boolean;
  spouseName: string;
  anniversary: Date | null;
  childrenCount: number;
  childrenNames: string;
  qualification: string;
  specialization: string;
}

// Input sanitization
const sanitize = (input: string): string => {
  return input
    .replace(/[<>'"]/g, '')
    .trim();
};

// Validation functions
const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[\d\s-]{10,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

const validateName = (name: string): string | null => {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  if (!/^[a-zA-Z\s.'-]+$/.test(name)) return 'Name contains invalid characters';
  return null;
};

const specializations = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Surgery',
  'Urology',
  'Other'
];

const qualifications = [
  'MBBS',
  'MD',
  'MS',
  'DNB',
  'DM',
  'MCh',
  'FRCS',
  'PhD',
  'Other'
];

export default function AddDoctorModal({ opened, onClose, onSuccess }: AddDoctorModalProps) {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<DoctorFormData>({
    name: '',
    contact: '',
    address: '',
    birthDate: null,
    isMarried: false,
    spouseName: '',
    anniversary: null,
    childrenCount: 0,
    childrenNames: '',
    qualification: '',
    specialization: ''
  });

  const updateField = <K extends keyof DoctorFormData>(field: K, value: DoctorFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      // Basic Info validation
      const nameError = validateName(formData.name);
      if (nameError) newErrors.name = nameError;

      if (!formData.contact.trim()) {
        newErrors.contact = 'Contact number is required';
      } else if (!validatePhone(formData.contact)) {
        newErrors.contact = 'Invalid phone number format';
      }

      if (!formData.address.trim()) {
        newErrors.address = 'Address is required';
      } else if (formData.address.trim().length < 5) {
        newErrors.address = 'Address must be at least 5 characters';
      }
    }

    if (step === 2) {
      // Professional validation
      if (!formData.qualification) {
        newErrors.qualification = 'Qualification is required';
      }
      if (!formData.specialization) {
        newErrors.specialization = 'Specialization is required';
      }
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the highlighted errors',
        color: 'red'
      });
      return false;
    }
    
    return true;
  };

  const nextStep = () => {
    if (validateStep(active)) {
      setActive(prev => Math.min(prev + 1, 2));
    }
  };

  const prevStep = () => setActive(prev => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setLoading(true);

    try {
      const sanitizedData = {
        name: sanitize(formData.name),
        contact: sanitize(formData.contact),
        address: sanitize(formData.address),
        birthDate: formData.birthDate?.toISOString() || null,
        isMarried: formData.isMarried,
        spouseName: sanitize(formData.spouseName),
        anniversary: formData.anniversary?.toISOString() || null,
        childrenCount: formData.childrenCount,
        childrenNames: sanitize(formData.childrenNames),
        qualification: formData.qualification,
        specialization: formData.specialization
      };

      const result = await api.post('/api/doctors', sanitizedData);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: `Dr. ${sanitizedData.name} added successfully!`,
          color: 'green',
          icon: <IconCheck size={18} />
        });
        handleClose();
        onSuccess?.();
      } else {
        throw new Error(result.error || 'Failed to add doctor');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: String(error),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActive(0);
    setFormData({
      name: '',
      contact: '',
      address: '',
      birthDate: null,
      isMarried: false,
      spouseName: '',
      anniversary: null,
      childrenCount: 0,
      childrenNames: '',
      qualification: '',
      specialization: ''
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text fw={600} size="lg">Add New Doctor</Text>}
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stepper active={active} onStepClick={setActive} size="sm" className={styles.stepper}>
        <Stepper.Step label="Basic Info" icon={<IconUser size={18} />}>
          <Stack gap="md" mt="md">
            <TextInput
              label="Full Name"
              placeholder="Dr. Full Name"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              error={errors.name}
            />
            <TextInput
              label="Contact Number"
              placeholder="+91 98765 43210"
              required
              value={formData.contact}
              onChange={(e) => updateField('contact', e.target.value)}
              error={errors.contact}
            />
            <Textarea
              label="Address"
              placeholder="Full address"
              required
              minRows={2}
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              error={errors.address}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Personal Details" description="Optional" icon={<IconHeart size={18} />}>
          <Stack gap="md" mt="md">
            <DateInput
              label="Birth Date"
              placeholder="Select date"
              value={formData.birthDate}
              onChange={(date) => updateField('birthDate', date as Date | null)}
              maxDate={new Date()}
              clearable
            />
            <Checkbox
              label="Married"
              checked={formData.isMarried}
              onChange={(e) => updateField('isMarried', e.target.checked)}
            />
            {formData.isMarried && (
              <>
                <TextInput
                  label="Spouse Name"
                  placeholder="Spouse's name"
                  value={formData.spouseName}
                  onChange={(e) => updateField('spouseName', e.target.value)}
                />
                <DateInput
                  label="Anniversary"
                  placeholder="Select date"
                  value={formData.anniversary}
                  onChange={(date) => updateField('anniversary', date as Date | null)}
                  maxDate={new Date()}
                  clearable
                />
              </>
            )}
            <NumberInput
              label="Number of Children"
              min={0}
              max={10}
              value={formData.childrenCount}
              onChange={(val) => updateField('childrenCount', Number(val) || 0)}
            />
            {formData.childrenCount > 0 && (
              <TextInput
                label="Children Names"
                placeholder="Comma separated names"
                value={formData.childrenNames}
                onChange={(e) => updateField('childrenNames', e.target.value)}
              />
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Professional" icon={<IconBriefcase size={18} />}>
          <Stack gap="md" mt="md">
            <Select
              label="Qualification"
              placeholder="Select qualification"
              required
              data={qualifications}
              value={formData.qualification}
              onChange={(val) => updateField('qualification', val || '')}
              error={errors.qualification}
              searchable
            />
            <Select
              label="Specialization"
              placeholder="Select specialization"
              required
              data={specializations}
              value={formData.specialization}
              onChange={(val) => updateField('specialization', val || '')}
              error={errors.specialization}
              searchable
            />
          </Stack>
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={active === 0 ? handleClose : prevStep}>
          {active === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={active === 2 ? handleSubmit : nextStep}
          loading={loading}
        >
          {active === 2 ? 'Save Doctor' : 'Next'}
        </Button>
      </Group>
    </Modal>
  );
}
