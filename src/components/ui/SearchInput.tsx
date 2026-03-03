'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Right-side icon/element */
  rightElement?: React.ReactNode;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = '', rightElement, ...props }, ref) => {
    return (
      <div className={`relative ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={ref}
          type="text"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg
                     transition-all duration-200 ease-out
                     focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue
                     hover:border-gray-400 placeholder:text-gray-400 text-sm"
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
